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
 * Helper to build StatsQuery from resource params.
 * Maps new param names (fromDate, toDate, surveyId) from resource.
 */
private fun buildStatsQuery(
    team: String,
    app: String?,
    fromDate: String?,
    toDate: String?,
    surveyId: String?,
    deviceType: String?,
    segment: List<String>? = null,
    task: String? = null,
    choice: List<String>? = null,
    rating: List<String>? = null,
    legacyChoiceFieldId: String? = null,
    legacyChoiceValue: String? = null,
    legacyRatingFieldId: String? = null,
    legacyRatingValue: Int? = null,
) = StatsQuery(
    team = team,
    app = app?.takeIf { it != FILTER_ALL },
    fromDate = fromDate,
    toDate = toDate,
    surveyId = surveyId,
    deviceType = deviceType?.takeIf { it != FILTER_ALL },
    segments = segment
        ?.mapNotNull { segmentStr ->
            val parts = segmentStr.split(":", limit = 2)
            if (parts.size == 2) Pair(parts[0], parts[1]) else null
        }
        ?: emptyList(),
    task = task,
    choiceFilters = parseChoiceFilters(choice, legacyChoiceFieldId, legacyChoiceValue),
    ratingFilters = parseRatingFilters(rating, legacyRatingFieldId, legacyRatingValue),
)

/**
 * Routes for feedback statistics endpoints.
 * Delegates business logic to StatsService.
 */
fun Route.statsRoutes(
    statsService: StatsService = defaultStatsService
) {
    // Dashboard stats (primary endpoint used by lumi-dashboard)
    get<ApiV1Intern.Stats.Dashboard> { params ->
        val team = call.authorizedTeam
        val p = params.parent

        val query = buildStatsQuery(
            team = team,
            app = p.app,
            fromDate = p.fromDate,
            toDate = p.toDate,
            surveyId = p.surveyId,
            deviceType = p.deviceType,
            segment = p.segment,
            task = p.task,
            choice = p.choice,
            rating = p.rating,
            legacyChoiceFieldId = p.choiceFieldId,
            legacyChoiceValue = p.choiceValue,
            legacyRatingFieldId = p.ratingFieldId,
            legacyRatingValue = p.ratingValue,
        )
        val stats = statsService.getDashboardStats(query)
        call.respond(stats)
    }

    // Get stats overview (new consolidated endpoint)
    get<ApiV1Intern.Stats.Overview> { params ->
        val team = call.authorizedTeam
        val p = params.parent
        
        val query = buildStatsQuery(
            team = team,
            app = p.app,
            fromDate = p.fromDate,
            toDate = p.toDate,
            surveyId = p.surveyId,
            deviceType = p.deviceType,
            segment = p.segment,
            choice = p.choice,
            rating = p.rating,
            legacyChoiceFieldId = p.choiceFieldId,
            legacyChoiceValue = p.choiceValue,
            legacyRatingFieldId = p.ratingFieldId,
            legacyRatingValue = p.ratingValue,
        )
        val overview = statsService.getStatsOverview(query)
        call.respond(overview)
    }
    
    // Get rating distribution
    get<ApiV1Intern.Stats.Ratings> { params ->
        val team = call.authorizedTeam
        val p = params.parent
        
        val query = buildStatsQuery(
            team = team,
            app = p.app,
            fromDate = p.fromDate,
            toDate = p.toDate,
            surveyId = p.surveyId,
            deviceType = p.deviceType,
            segment = p.segment,
            choice = p.choice,
            rating = p.rating,
            legacyChoiceFieldId = p.choiceFieldId,
            legacyChoiceValue = p.choiceValue,
            legacyRatingFieldId = p.ratingFieldId,
            legacyRatingValue = p.ratingValue,
        )
        val distribution = statsService.getRatingDistribution(query)
        call.respond(distribution)
    }
    
    // Get timeline data
    get<ApiV1Intern.Stats.Timeline> { params ->
        val team = call.authorizedTeam
        val p = params.parent

        val query = buildStatsQuery(
            team = team,
            app = p.app,
            fromDate = p.fromDate,
            toDate = p.toDate,
            surveyId = p.surveyId,
            deviceType = p.deviceType,
            segment = p.segment,
            choice = p.choice,
            rating = p.rating,
            legacyChoiceFieldId = p.choiceFieldId,
            legacyChoiceValue = p.choiceValue,
            legacyRatingFieldId = p.ratingFieldId,
            legacyRatingValue = p.ratingValue,
        )
        val timeline = statsService.getTimeline(query)
        call.respond(timeline)
    }

    // Get Top Tasks statistics
    get<ApiV1Intern.Stats.TopTasks> { params ->
        val team = call.authorizedTeam
        val p = params.parent

        val query = buildStatsQuery(
            team = team,
            app = p.app,
            fromDate = p.fromDate,
            toDate = p.toDate,
            surveyId = p.surveyId,
            deviceType = p.deviceType,
            segment = p.segment,
            task = p.task,
            choice = p.choice,
            rating = p.rating,
            legacyChoiceFieldId = p.choiceFieldId,
            legacyChoiceValue = p.choiceValue,
            legacyRatingFieldId = p.ratingFieldId,
            legacyRatingValue = p.ratingValue,
        )
        val stats = statsService.getTopTasksStats(query)
        call.respond(stats)
    }

    // Get blocker statistics for Top Tasks (word frequency + theme clustering)
    get<ApiV1Intern.Stats.Blockers> { params ->
        val team = call.authorizedTeam
        val p = params.parent

        val query = buildStatsQuery(
            team = team,
            app = p.app,
            fromDate = p.fromDate,
            toDate = p.toDate,
            surveyId = p.surveyId,
            deviceType = p.deviceType,
            segment = p.segment,
            task = p.task,
            choice = p.choice,
            rating = p.rating,
            legacyChoiceFieldId = p.choiceFieldId,
            legacyChoiceValue = p.choiceValue,
            legacyRatingFieldId = p.ratingFieldId,
            legacyRatingValue = p.ratingValue,
        )
        val stats = statsService.getBlockerStats(query)
        call.respond(stats)
    }

    // Get Task Priority statistics ("long neck" distribution)
    get<ApiV1Intern.Stats.TaskPriority> { params ->
        val team = call.authorizedTeam
        val p = params.parent

        val query = buildStatsQuery(
            team = team,
            app = p.app,
            fromDate = p.fromDate,
            toDate = p.toDate,
            surveyId = p.surveyId,
            deviceType = p.deviceType,
            segment = p.segment,
            choice = p.choice,
            rating = p.rating,
            legacyChoiceFieldId = p.choiceFieldId,
            legacyChoiceValue = p.choiceValue,
            legacyRatingFieldId = p.ratingFieldId,
            legacyRatingValue = p.ratingValue,
        )
        val stats = statsService.getTaskPriorityStats(query)
        call.respond(stats)
    }

    // Get Survey Type distribution
    get<ApiV1Intern.Stats.SurveyTypes> { params ->
        val team = call.authorizedTeam
        val p = params.parent

        val query = buildStatsQuery(
            team = team,
            app = p.app,
            fromDate = p.fromDate,
            toDate = p.toDate,
            surveyId = null,
            deviceType = p.deviceType,
            segment = p.segment,
            choice = p.choice,
            rating = p.rating,
            legacyChoiceFieldId = p.choiceFieldId,
            legacyChoiceValue = p.choiceValue,
            legacyRatingFieldId = p.ratingFieldId,
            legacyRatingValue = p.ratingValue,
        )
        val distribution = statsService.getSurveyTypeDistribution(query)
        call.respond(distribution)
    }
}
