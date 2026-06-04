package no.nav.lumi.routes

import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.request.header
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import kotlinx.serialization.Serializable
import no.nav.lumi.config.ServerEnv
import no.nav.lumi.config.auth.BrukerPrincipal
import no.nav.lumi.config.auth.TexasClient
import no.nav.lumi.config.getBrukerPrincipal
import no.nav.lumi.integrations.nais.NaisApiResult
import no.nav.lumi.integrations.nais.NaisGraphQlClient
import java.time.Duration

private const val NAIS_API_OBO_TARGET_ENV = "LUMI_NAIS_API_OBO_TARGET"
private const val NAIS_API_OBO_TARGETS_ENV = "LUMI_NAIS_API_OBO_TARGETS"

fun Route.naisAuthDiagnosticsRoutes() {
    if (!ServerEnv.current.nais.isDev) return

    val naisClient = NaisGraphQlClient.fromEnvOrNull()
    val texasClient = TexasClient(
        introspectionEndpoint = ServerEnv.current.nais.tokenIntrospectionEndpoint
            ?: "http://localhost:8080/introspect",
        tokenExchangeEndpoint = ServerEnv.current.nais.tokenExchangeEndpoint
    )

    get("/api/v1/intern/diagnostics/nais-auth") {
        val principal = call.getBrukerPrincipal()
        val bearerToken = call.bearerToken()

        if (principal == null || bearerToken == null) {
            call.respond(
                HttpStatusCode.Unauthorized,
                NaisAuthDiagnosticsResponse(
                    enabled = false,
                    cluster = ServerEnv.current.nais.clusterName,
                    message = "Missing authenticated user or bearer token",
                    principal = PrincipalDiagnostics(),
                )
            )
            return@get
        }

        if (naisClient == null) {
            call.respond(
                HttpStatusCode.ServiceUnavailable,
                NaisAuthDiagnosticsResponse(
                    enabled = false,
                    cluster = ServerEnv.current.nais.clusterName,
                    message = "NAIS GraphQL client is not configured",
                    principal = principal.toDiagnostics(),
                )
            )
            return@get
        }

        val skipCache = call.request.queryParameters["skipCache"] == "true"
        val targets = naisApiOboTargets(
            clusterName = ServerEnv.current.nais.clusterName,
            queryTargets = call.request.queryParameters.getAll("target").orEmpty(),
        )

        val userTeamDiagnostics = diagnoseUserTeamEntraGroups(principal, naisClient)
        val meDiagnostics = targets.map { target ->
            diagnoseMeWithTarget(
                target = target,
                bearerToken = bearerToken,
                skipCache = skipCache,
                texasClient = texasClient,
                naisClient = naisClient,
            )
        }

        call.respond(
            NaisAuthDiagnosticsResponse(
                enabled = true,
                cluster = ServerEnv.current.nais.clusterName,
                principal = principal.toDiagnostics(),
                userTeamEntraGroups = userTeamDiagnostics,
                meTargets = meDiagnostics,
            )
        )
    }
}

private suspend fun diagnoseMeWithTarget(
    target: String,
    bearerToken: String,
    skipCache: Boolean,
    texasClient: TexasClient,
    naisClient: NaisGraphQlClient,
): NaisMeTargetDiagnostics {
    val exchangeStart = System.nanoTime()
    val exchangedToken = texasClient.exchangeToken(
        userToken = bearerToken,
        identityProvider = "entra_id",
        target = target,
        skipCache = skipCache,
    )
    val exchangeDuration = elapsedMs(exchangeStart)

    if (exchangedToken == null) {
        return NaisMeTargetDiagnostics(
            target = target,
            exchange = StepDiagnostics(
                ok = false,
                durationMs = exchangeDuration,
                message = "Texas token exchange failed or returned non-OK",
            ),
        )
    }

    val meStart = System.nanoTime()
    val viewerResult = naisClient.diagnoseViewerWithBearerToken(exchangedToken.accessToken)
    val meDuration = elapsedMs(meStart)

    val viewer = when (viewerResult) {
        is NaisApiResult.Success -> ViewerDiagnostics(
            ok = true,
            durationMs = meDuration,
            typename = viewerResult.value.typename,
            teamCount = viewerResult.value.teamSlugs.size,
            teamSlugs = viewerResult.value.teamSlugs.sorted(),
        )
        is NaisApiResult.Error -> ViewerDiagnostics(
            ok = false,
            durationMs = meDuration,
            message = viewerResult.message,
        )
    }

    return NaisMeTargetDiagnostics(
        target = target,
        exchange = StepDiagnostics(
            ok = true,
            durationMs = exchangeDuration,
            message = "Texas exchange returned ${exchangedToken.tokenType ?: "token"} with expiresIn=${exchangedToken.expiresIn ?: "unknown"}",
        ),
        me = viewer,
    )
}

private suspend fun diagnoseUserTeamEntraGroups(
    principal: BrukerPrincipal,
    naisClient: NaisGraphQlClient,
): UserTeamEntraGroupDiagnostics {
    val email = principal.email
    if (email.isNullOrBlank()) {
        return UserTeamEntraGroupDiagnostics(
            ok = false,
            durationMs = 0,
            message = "Authenticated token has no email/preferred_username claim",
        )
    }

    val start = System.nanoTime()
    val result = naisClient.getTeamEntraGroupsForUserResult(email)
    val durationMs = elapsedMs(start)

    return when (result) {
        is NaisApiResult.Success -> {
            val tokenGroups = principal.groups.mapTo(mutableSetOf()) { it.lowercase() }
            val teams = result.value
            val teamsWithGroup = teams.filter { !it.entraIdGroupId.isNullOrBlank() }
            val matchedTeams = teamsWithGroup.filter { it.entraIdGroupId?.lowercase() in tokenGroups }
            val missingGroupMatch = teams.filter { team ->
                team.entraIdGroupId.isNullOrBlank() || team.entraIdGroupId.lowercase() !in tokenGroups
            }

            UserTeamEntraGroupDiagnostics(
                ok = true,
                durationMs = durationMs,
                teamCount = teams.size,
                teamsWithEntraGroup = teamsWithGroup.size,
                teamsMatchedByTokenGroups = matchedTeams.size,
                matchedTeamSlugs = matchedTeams.map { it.slug }.sorted(),
                missingGroupMatchTeamSlugs = missingGroupMatch.map { it.slug }.sorted(),
                teamGroupMappings = teams.map { team ->
                    TeamEntraGroupMatchDiagnostics(
                        slug = team.slug,
                        entraIdGroupId = team.entraIdGroupId,
                        matchedByTokenGroup = !team.entraIdGroupId.isNullOrBlank() && team.entraIdGroupId.lowercase() in tokenGroups,
                    )
                }.sortedBy { it.slug },
            )
        }
        is NaisApiResult.Error -> UserTeamEntraGroupDiagnostics(
            ok = false,
            durationMs = durationMs,
            message = result.message,
        )
    }
}

private fun naisApiOboTargets(clusterName: String?, queryTargets: List<String>): List<String> {
    val explicitTargets = queryTargets
        .flatMap { it.split(",") }
        .map { it.trim() }
        .filter { it.isNotBlank() }

    if (explicitTargets.isNotEmpty()) return explicitTargets.distinct()

    val envTargets = sequenceOf(System.getenv(NAIS_API_OBO_TARGET_ENV))
        .plus(System.getenv(NAIS_API_OBO_TARGETS_ENV))
        .filterNotNull()
        .flatMap { it.split(",").asSequence() }
        .map { it.trim() }
        .filter { it.isNotBlank() }
        .toList()

    if (envTargets.isNotEmpty()) return envTargets.distinct()

    val cluster = clusterName ?: "dev-gcp"
    return listOf(
        "api://$cluster.nais-system.nais-api/.default",
        "api://$cluster.nais.nais-api/.default",
    )
}

private fun ApplicationCall.bearerToken(): String? {
    val auth = request.header(HttpHeaders.Authorization)?.trim() ?: return null
    if (!auth.startsWith("Bearer ", ignoreCase = true)) return null
    return auth.substringAfter(" ").trim().takeIf { it.isNotBlank() }
}

private fun BrukerPrincipal.toDiagnostics() = PrincipalDiagnostics(
    hasNavIdent = !navIdent.isNullOrBlank(),
    hasName = !name.isNullOrBlank(),
    hasEmail = !email.isNullOrBlank(),
    groupCount = groups.size,
    clientId = clientId,
)

private fun elapsedMs(startNanos: Long): Long =
    Duration.ofNanos(System.nanoTime() - startNanos).toMillis()

@Serializable
data class NaisAuthDiagnosticsResponse(
    val enabled: Boolean,
    val cluster: String?,
    val message: String? = null,
    val principal: PrincipalDiagnostics,
    val userTeamEntraGroups: UserTeamEntraGroupDiagnostics? = null,
    val meTargets: List<NaisMeTargetDiagnostics> = emptyList(),
)

@Serializable
data class PrincipalDiagnostics(
    val hasNavIdent: Boolean = false,
    val hasName: Boolean = false,
    val hasEmail: Boolean = false,
    val groupCount: Int = 0,
    val clientId: String? = null,
)

@Serializable
data class UserTeamEntraGroupDiagnostics(
    val ok: Boolean,
    val durationMs: Long,
    val teamCount: Int? = null,
    val teamsWithEntraGroup: Int? = null,
    val teamsMatchedByTokenGroups: Int? = null,
    val matchedTeamSlugs: List<String> = emptyList(),
    val missingGroupMatchTeamSlugs: List<String> = emptyList(),
    val teamGroupMappings: List<TeamEntraGroupMatchDiagnostics> = emptyList(),
    val message: String? = null,
)

@Serializable
data class TeamEntraGroupMatchDiagnostics(
    val slug: String,
    val entraIdGroupId: String? = null,
    val matchedByTokenGroup: Boolean,
)

@Serializable
data class NaisMeTargetDiagnostics(
    val target: String,
    val exchange: StepDiagnostics,
    val me: ViewerDiagnostics? = null,
)

@Serializable
data class StepDiagnostics(
    val ok: Boolean,
    val durationMs: Long,
    val message: String? = null,
)

@Serializable
data class ViewerDiagnostics(
    val ok: Boolean,
    val durationMs: Long,
    val typename: String? = null,
    val teamCount: Int? = null,
    val teamSlugs: List<String> = emptyList(),
    val message: String? = null,
)
