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
 * `archivedAt == null` means active (or restored after being archived).
 * `lastSubmissionAt` drives the recency signal and, for archived surveys,
 * the "still receiving submissions" badge (lastSubmissionAt > archivedAt).
 */
@Serializable
data class SurveyMetaEntry(
    val archivedAt: String?,
    val lastSubmissionAt: String? = null,
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

private fun bootstrapCacheGenerationKey(team: String) = "generation:team=${team.lowercase()}"

/**
 * Per-user bootstrap cache key, or null when the principal has no stable user
 * identity — the response includes `availableTeams`, so a shared key (e.g.
 * "user=null") could leak one user's team memberships to another.
 */
internal fun bootstrapCacheKey(team: String, principal: no.nav.lumi.config.auth.BrukerPrincipal): String? {
    val userIdentity = stablePrincipalIdentity(principal) ?: return null
    return "${bootstrapCacheTeamPrefix(team)}user=$userIdentity".lowercase()
}

internal fun stablePrincipalIdentity(principal: no.nav.lumi.config.auth.BrukerPrincipal): String? =
    principal.navIdent?.trim()?.takeIf { it.isNotEmpty() }
        ?: principal.email?.trim()?.takeIf { it.isNotEmpty() }

internal data class BootstrapCacheLookup(
    val key: String?,
    val value: String?,
)

/**
 * Versioned cache access prevents an in-flight GET from refilling a stale
 * entry after a concurrent archive/restore invalidation. The mutation first
 * advances the team generation; late writes remain on the old generation.
 */
internal class VersionedBootstrapCache(private val cache: StringCache) {
    fun lookup(
        team: String,
        principal: no.nav.lumi.config.auth.BrukerPrincipal,
    ): BootstrapCacheLookup {
        val userKey = bootstrapCacheKey(team, principal)
            ?: return BootstrapCacheLookup(key = null, value = null)
        val generation = cache.get(bootstrapCacheGenerationKey(team))?.toLongOrNull() ?: 0L
        val key = "$userKey&generation=$generation"
        return BootstrapCacheLookup(key = key, value = cache.get(key))
    }

    fun set(lookup: BootstrapCacheLookup, value: String, ttl: Duration) {
        lookup.key?.let { cache.set(it, value, ttl) }
    }

    fun invalidate(team: String) {
        cache.increment(bootstrapCacheGenerationKey(team))
        cache.clearByPrefix(bootstrapCacheTeamPrefix(team))
    }
}

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
    val versionedBootstrapCache = VersionedBootstrapCache(bootstrapCache)

    get<ApiV1Intern.Filters.Bootstrap> {
        val team = call.authorizedTeam
        val teams = call.authorizedTeams
        val principal = call.authorizedPrincipal

        // Cache is shared across users (Valkey). Include user identity to avoid leaking `availableTeams`.
        // Team comes first so team-scoped invalidation can clear by prefix. Principals without a
        // stable user identity are served uncached (a shared key would leak team memberships).
        val cacheLookup = versionedBootstrapCache.lookup(team, principal)

        cacheLookup.value?.let { cachedJson ->
            call.response.headers.append(HttpHeaders.CacheControl, "private, max-age=300")
            call.respondText(cachedJson, ContentType.Application.Json)
            return@get
        }

        // Each repository call manages its own transaction.
        // This endpoint is designed for long caching, so multiple DB round-trips are acceptable.
        val apps = feedbackRepository.findDistinctApps(team)
        val surveysByApp = feedbackRepository.findSurveysByApp(team)
        val tags = feedbackRepository.findAllTags(team)
        val archiveStates = surveyMetadataRepository.findByTeam(team).associateBy { it.surveyId }
        val lastSubmissionBySurvey = feedbackRepository.findLastSubmissionBySurvey(team)
        val surveyMeta = (archiveStates.keys + lastSubmissionBySurvey.keys).associateWith { surveyId ->
            SurveyMetaEntry(
                archivedAt = archiveStates[surveyId]?.archivedAt,
                lastSubmissionAt = lastSubmissionBySurvey[surveyId],
            )
        }

        val response = FilterBootstrapResponse(
            generatedAt = Instant.now().toString(),
            selectedTeam = team,
            availableTeams = teams.sorted(),
            apps = apps.sorted(),
            surveysByApp = surveysByApp.mapValues { it.value.sorted() }.toSortedMap(),
            tags = tags.sorted(),
            surveyMeta = surveyMeta,
        )

        versionedBootstrapCache.set(
            cacheLookup,
            json.encodeToString(response),
            ttl = Duration.ofMinutes(5),
        )
        call.response.headers.append(HttpHeaders.CacheControl, "private, max-age=300")

        call.respond(response)
    }
}
