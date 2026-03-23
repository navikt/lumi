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
): StatsQuery = StatsQuery(
    team = team,
    app = app?.takeIf { it != FILTER_ALL },
    fromDate = fromDate,
    toDate = toDate,
    surveyId = surveyIdOverride,
    deviceType = deviceType?.takeIf { it != FILTER_ALL },
    segments = segment
        ?.mapNotNull { segmentStr ->
            val parts = segmentStr.split(":", limit = 2)
            if (parts.size == 2) Pair(parts[0], parts[1]) else null
        }
        ?: emptyList(),
    task = task,
    choiceFilters = parseChoiceFilters(choice, choiceFieldId, choiceValue),
    ratingFilters = parseRatingFilters(rating, ratingFieldId, ratingValue),
)

/**
 * Routes for feedback statistics endpoints.
 * Delegates business logic to StatsService.
 */
fun Route.statsRoutes(
    statsService: StatsService = defaultStatsService
) {
    get<ApiV1Intern.Stats.Dashboard> { params ->
        val query = params.parent.toStatsQuery(call.authorizedTeam)
        call.respond(statsService.getDashboardStats(query))
    }

    get<ApiV1Intern.Stats.Overview> { params ->
        val query = params.parent.toStatsQuery(call.authorizedTeam)
        call.respond(statsService.getStatsOverview(query))
    }

    get<ApiV1Intern.Stats.Ratings> { params ->
        val query = params.parent.toStatsQuery(call.authorizedTeam)
        call.respond(statsService.getRatingDistribution(query))
    }

    get<ApiV1Intern.Stats.Timeline> { params ->
        val query = params.parent.toStatsQuery(call.authorizedTeam)
        call.respond(statsService.getTimeline(query))
    }

    get<ApiV1Intern.Stats.TopTasks> { params ->
        val query = params.parent.toStatsQuery(call.authorizedTeam)
        call.respond(statsService.getTopTasksStats(query))
    }

    get<ApiV1Intern.Stats.Blockers> { params ->
        val query = params.parent.toStatsQuery(call.authorizedTeam)
        call.respond(statsService.getBlockerStats(query))
    }

    get<ApiV1Intern.Stats.TaskPriority> { params ->
        val query = params.parent.toStatsQuery(call.authorizedTeam)
        call.respond(statsService.getTaskPriorityStats(query))
    }

    get<ApiV1Intern.Stats.SurveyTypes> { params ->
        val query = params.parent.toStatsQuery(call.authorizedTeam, surveyIdOverride = null)
        call.respond(statsService.getSurveyTypeDistribution(query))
    }
}
