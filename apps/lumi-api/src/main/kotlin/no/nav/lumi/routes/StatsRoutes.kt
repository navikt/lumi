package no.nav.lumi.routes

import io.ktor.server.resources.get
import io.ktor.server.response.*
import io.ktor.server.routing.*
import no.nav.lumi.config.auth.authorizedTeam
import no.nav.lumi.domain.FILTER_ALL
import no.nav.lumi.domain.StatsQuery
import no.nav.lumi.integrations.valkey.ValkeyStatsCache
import no.nav.lumi.service.StatsService

private val defaultStatsCache = ValkeyStatsCache.fromEnvOrFallback()
private val defaultStatsService = StatsService(statsCache = defaultStatsCache)

/**
 * Extension to convert Stats resource params into a StatsQuery.
 * Handles FILTER_ALL normalization, segment parsing, and legacy filter compat.
 */
internal fun ApiV1Intern.Stats.toStatsQuery(
    team: String,
    surveyIdOverride: String? = surveyId,
): StatsQuery {
    val normalizedFromDate = fromDate?.takeIf { it.isNotBlank() }
    val normalizedToDate = toDate?.takeIf { it.isNotBlank() }
    validateDateRange(normalizedFromDate, normalizedToDate)
    return StatsQuery(
    team = team,
    includeArchived = includeArchived ?: false,
    app = app?.takeIf { it != FILTER_ALL },
    fromDate = normalizedFromDate,
    toDate = normalizedToDate,
    surveyId = surveyIdOverride,
    deviceType = deviceType?.takeIf { it != FILTER_ALL },
    segments = parseSegments(segment),
    task = task,
    choiceFilters = parseChoiceFilters(choice, choiceFieldId, choiceValue),
    ratingFilters = parseRatingFilters(rating, ratingFieldId, ratingValue),
)
}

/**
 * Routes for feedback statistics endpoints.
 * Delegates business logic to StatsService.
 */
fun Route.statsRoutes(
    statsService: StatsService = defaultStatsService
) {
    // Dashboard stats (primary endpoint used by lumi-dashboard)
    get<ApiV1Intern.Stats.Dashboard> { params ->
        val query = params.parent.toStatsQuery(call.authorizedTeam)
        call.respond(statsService.getDashboardStats(query))
    }

    // Stats overview (consolidated totals + rating distribution)
    get<ApiV1Intern.Stats.Overview> { params ->
        val query = params.parent.toStatsQuery(call.authorizedTeam)
        call.respond(statsService.getStatsOverview(query))
    }

    // Rating distribution
    get<ApiV1Intern.Stats.Ratings> { params ->
        val query = params.parent.toStatsQuery(call.authorizedTeam)
        call.respond(statsService.getRatingDistribution(query))
    }

    // Timeline data (counts by date)
    get<ApiV1Intern.Stats.Timeline> { params ->
        val query = params.parent.toStatsQuery(call.authorizedTeam)
        call.respond(statsService.getTimeline(query))
    }

    // Top Tasks statistics
    get<ApiV1Intern.Stats.TopTasks> { params ->
        val query = params.parent.toStatsQuery(call.authorizedTeam)
        call.respond(statsService.getTopTasksStats(query))
    }

    // Blocker text analysis for Top Tasks (phrases, examples, and themes)
    get<ApiV1Intern.Stats.Blockers> { params ->
        val query = params.parent.toStatsQuery(call.authorizedTeam)
        call.respond(statsService.getBlockerStats(query))
    }

    // Task Priority statistics ("long neck" distribution)
    get<ApiV1Intern.Stats.TaskPriority> { params ->
        val query = params.parent.toStatsQuery(call.authorizedTeam)
        call.respond(statsService.getTaskPriorityStats(query))
    }

    // Survey Type distribution (surveyId forced to null — counts across all surveys)
    get<ApiV1Intern.Stats.SurveyTypes> { params ->
        val query = params.parent.toStatsQuery(call.authorizedTeam, surveyIdOverride = null)
        call.respond(statsService.getSurveyTypeDistribution(query))
    }
}
