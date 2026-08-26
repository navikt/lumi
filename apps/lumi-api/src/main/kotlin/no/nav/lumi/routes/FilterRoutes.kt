package no.nav.lumi.routes

import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.server.plugins.ratelimit.rateLimit
import io.ktor.server.resources.get
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import no.nav.lumi.config.BootstrapRefreshRateLimit
import no.nav.lumi.config.auth.authorizedPrincipal
import no.nav.lumi.config.auth.authorizedTeam
import no.nav.lumi.config.auth.authorizedTeams
import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.integrations.valkey.StringCache
import no.nav.lumi.service.BootstrapCacheInvalidator
import no.nav.lumi.service.bootstrapCacheGenerationKey
import no.nav.lumi.service.bootstrapCacheTeamPrefix
import no.nav.lumi.service.sharedBootstrapCache
import no.nav.lumi.repository.FeedbackRepository
import no.nav.lumi.repository.SurveyMetadataRepository
import no.nav.lumi.repository.SurveyDefinitionRepository
import no.nav.lumi.service.FeedbackRetentionService
import java.time.Duration
import java.time.Instant
import java.time.ZoneOffset

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
    val surveyMetaByApp: Map<String, Map<String, SurveyMetaEntry>> = emptyMap(),
    val retentionWarnings: List<SurveyRetentionWarning> = emptyList(),
)

@Serializable
data class SurveyRetentionWarning(
    val surveyId: String,
    val lastActivityAt: String,
    val scheduledFor: String,
)

/**
 * Per-survey dashboard metadata. Surveys without an entry are active.
 * `archivedAt == null` means active (or restored after being archived).
 * `firstSubmissionAt` identifies the beginning of the survey's response history.
 * `lastSubmissionAt` drives the recency signal and, for archived surveys,
 * the "still receiving submissions" badge (lastSubmissionAt > archivedAt).
 */
@Serializable
data class SurveyMetaEntry(
    val archivedAt: String?,
    val firstSubmissionAt: String? = null,
    val lastSubmissionAt: String? = null,
)

private val defaultRepository = FeedbackRepository()
private val defaultSurveyMetadataRepository = SurveyMetadataRepository()
private val defaultSurveyDefinitionRepository = SurveyDefinitionRepository()

/**
 * Per-user bootstrap cache key, or null when the principal has no stable user
 * identity — the response includes `availableTeams`, so a shared key (e.g.
 * "user=null") could leak one user's team memberships to another.
 */
internal fun bootstrapCacheKey(team: String, principal: no.nav.lumi.config.auth.BrukerPrincipal): String? {
    val userIdentity = stablePrincipalIdentity(principal) ?: return null
    // Version the response contract so rolling deploys cannot reuse bootstrap
    // payloads that predate newly added metadata fields.
    return "${bootstrapCacheTeamPrefix(team)}user=${userIdentity.lowercase()}&responseVersion=3"
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
    private val invalidator = BootstrapCacheInvalidator(cache)

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
        invalidator.invalidateTeam(team)
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
    surveyDefinitionRepository: SurveyDefinitionRepository = defaultSurveyDefinitionRepository,
    bootstrapCache: StringCache = sharedBootstrapCache,
) {
    val versionedBootstrapCache = VersionedBootstrapCache(bootstrapCache)

    rateLimit(BootstrapRefreshRateLimit) {
        get<ApiV1Intern.Filters.Bootstrap> { params ->
            val team = call.authorizedTeam
            val teams = call.authorizedTeams
            val principal = call.authorizedPrincipal
            val forceRefresh = when (params.refresh) {
                null, "false" -> false
                "true" -> true
                else -> throw ApiErrorException.BadRequestException(
                    "Invalid refresh: expected true or false",
                )
            }

            // Cache is shared across users (Valkey). Include user identity to avoid leaking
            // `availableTeams`. Team comes first so team-scoped invalidation can clear by prefix.
            // Principals without a stable identity are served uncached.
            val cacheLookup = versionedBootstrapCache.lookup(team, principal)

            if (!forceRefresh) {
                cacheLookup.value?.let { cachedJson ->
                    call.response.headers.append(HttpHeaders.CacheControl, "private, max-age=300")
                    call.respondText(cachedJson, ContentType.Application.Json)
                    return@get
                }
            }

            // Each repository call manages its own transaction. Survey options and
            // recency metadata deliberately share one aggregation/snapshot.
            val apps = feedbackRepository.findDistinctApps(team)
            val surveyOverview = feedbackRepository.findSurveyOverview(team)
            val tags = feedbackRepository.findAllTags(team)
            val archiveStates = surveyMetadataRepository.findByTeam(team).associateBy { it.surveyId }
            val now = Instant.now()
            val scheduledBefore = now.atZone(ZoneOffset.UTC)
                .plusMonths(FeedbackRetentionService.DEFINITION_WARNING_LEAD_MONTHS)
                .toInstant()
            val retentionWarnings = surveyDefinitionRepository
                .findUpcomingRetentionCandidates(team, scheduledBefore)
                .map { candidate ->
                    SurveyRetentionWarning(
                        surveyId = candidate.surveyId,
                        lastActivityAt = candidate.lastActivityAt.toString(),
                        scheduledFor = candidate.scheduledFor.toString(),
                    )
                }
            val firstSubmissionBySurvey = surveyOverview.firstSubmissionBySurvey
            val lastSubmissionBySurvey = surveyOverview.lastSubmissionBySurvey
            val surveyMeta = (
                archiveStates.keys + firstSubmissionBySurvey.keys + lastSubmissionBySurvey.keys
            ).associateWith { surveyId ->
                SurveyMetaEntry(
                    archivedAt = archiveStates[surveyId]?.archivedAt,
                    firstSubmissionAt = firstSubmissionBySurvey[surveyId],
                    lastSubmissionAt = lastSubmissionBySurvey[surveyId],
                )
            }
            val surveyMetaByApp = surveyOverview.submissionBoundsByApp.mapValues { (_, boundsBySurvey) ->
                boundsBySurvey.mapValues { (surveyId, bounds) ->
                    SurveyMetaEntry(
                        archivedAt = archiveStates[surveyId]?.archivedAt,
                        firstSubmissionAt = bounds.firstSubmissionAt,
                        lastSubmissionAt = bounds.lastSubmissionAt,
                    )
                }.toSortedMap()
            }.toSortedMap()

            val response = FilterBootstrapResponse(
                generatedAt = Instant.now().toString(),
                selectedTeam = team,
                availableTeams = teams.sorted(),
                apps = apps.sorted(),
                surveysByApp = surveyOverview.surveysByApp.mapValues { it.value.sorted() }.toSortedMap(),
                tags = tags.sorted(),
                surveyMeta = surveyMeta,
                surveyMetaByApp = surveyMetaByApp,
                retentionWarnings = retentionWarnings,
            )

            if (!forceRefresh) {
                versionedBootstrapCache.set(
                    cacheLookup,
                    json.encodeToString(response),
                    ttl = Duration.ofMinutes(5),
                )
            }
            call.response.headers.append(
                HttpHeaders.CacheControl,
                if (forceRefresh) "private, no-store" else "private, max-age=300",
            )

            call.respond(response)
        }
    }
}
