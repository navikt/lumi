package no.nav.lumi.routes

import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.server.resources.get
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import no.nav.lumi.config.auth.authorizedTeam
import no.nav.lumi.config.auth.authorizedTeams
import no.nav.lumi.config.auth.authorizedPrincipal
import no.nav.lumi.integrations.valkey.StringCache
import no.nav.lumi.integrations.valkey.ValkeyStringCache
import no.nav.lumi.repository.FeedbackRepository
import no.nav.lumi.repository.SurveyMetadataRepository
import java.time.Instant
import java.time.Duration

/**
 * Response for GET /api/v1/intern/filters/bootstrap
 *
 * Provides all data needed for FilterBar dropdowns in a single request.
 * This endpoint is designed for long caching (5-10 minutes).
 */
@Serializable
data class FilterBootstrapResponse(
    val generatedAt: String,
    val selectedTeam: String,
    val availableTeams: List<String>,
    val deviceTypes: List<String> = listOf("mobile", "tablet", "desktop"),
    val apps: List<String>,
    val surveysByApp: Map<String, List<String>>,
    val tags: List<String>,
    val surveyMeta: Map<String, SurveyMetaEntry> = emptyMap(),
)

/**
 * Per-survey dashboard metadata. Surveys without an entry are active.
 * `archivedAt == null` means the survey was restored after being archived.
 */
@Serializable
data class SurveyMetaEntry(
    val archivedAt: String?,
)

private val defaultRepository = FeedbackRepository()
private val defaultSurveyMetadataRepository = SurveyMetadataRepository()

/**
 * Shared bootstrap cache instance so mutations (e.g. survey archiving) can
 * invalidate what the bootstrap route cached. Keys start with "team=<team>&"
 * — see [bootstrapCacheTeamPrefix].
 */
internal val sharedBootstrapCache: StringCache by lazy {
    ValkeyStringCache.fromEnvOrFallback(keyPrefix = "filters:bootstrap:")
}

/** Cache-key prefix covering every user's bootstrap entry for a team. */
internal fun bootstrapCacheTeamPrefix(team: String) = "team=${team.lowercase()}&"

private val json = Json {
    ignoreUnknownKeys = true
    encodeDefaults = true
}

/**
 * Routes for filter bootstrap and facets.
 *
 * These endpoints provide metadata for FilterBar dropdowns,
 * enabling the frontend to render filter controls before fetching actual data.
 */
fun Route.filterRoutes(
    feedbackRepository: FeedbackRepository = defaultRepository,
    surveyMetadataRepository: SurveyMetadataRepository = defaultSurveyMetadataRepository,
    bootstrapCache: StringCache = sharedBootstrapCache,
) {
    get<ApiV1Intern.Filters.Bootstrap> {
        val team = call.authorizedTeam
        val teams = call.authorizedTeams
        val principal = call.authorizedPrincipal

        // Cache is shared across users (Valkey). Include user identity to avoid leaking `availableTeams`.
        // Team comes first so team-scoped invalidation can clear by prefix.
        val cacheKey = "${bootstrapCacheTeamPrefix(team)}user=${principal.navIdent}".lowercase()

        bootstrapCache.get(cacheKey)?.let { cachedJson ->
            call.response.headers.append(HttpHeaders.CacheControl, "private, max-age=300")
            call.respondText(cachedJson, ContentType.Application.Json)
            return@get
        }

        // Each repository call manages its own transaction.
        // This endpoint is designed for long caching, so multiple DB round-trips are acceptable.
        val apps = feedbackRepository.findDistinctApps(team)
        val surveysByApp = feedbackRepository.findSurveysByApp(team)
        val tags = feedbackRepository.findAllTags(team)
        val surveyMeta = surveyMetadataRepository.findByTeam(team)
            .associate { it.surveyId to SurveyMetaEntry(archivedAt = it.archivedAt) }

        val response = FilterBootstrapResponse(
            generatedAt = Instant.now().toString(),
            selectedTeam = team,
            availableTeams = teams.sorted(),
            apps = apps.sorted(),
            surveysByApp = surveysByApp.mapValues { it.value.sorted() }.toSortedMap(),
            tags = tags.sorted(),
            surveyMeta = surveyMeta,
        )

        bootstrapCache.set(cacheKey, json.encodeToString(response), ttl = Duration.ofMinutes(5))
        call.response.headers.append(HttpHeaders.CacheControl, "private, max-age=300")

        call.respond(response)
    }
}
