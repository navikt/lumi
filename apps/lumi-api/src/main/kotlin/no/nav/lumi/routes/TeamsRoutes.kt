package no.nav.lumi.routes

import io.ktor.server.resources.get
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import no.nav.lumi.config.auth.authorizedTeams
import no.nav.lumi.domain.TeamsAndApps
import no.nav.lumi.repository.FeedbackRepository

private val defaultRepository = FeedbackRepository()

fun Route.teamsRoutes(
    feedbackRepository: FeedbackRepository = defaultRepository,
) {
    get<ApiV1Intern.Teams> {
        val teams = call.authorizedTeams

        val teamsToApps = mutableMapOf<String, Set<String>>()
        for (team in teams.sorted()) {
            teamsToApps[team] = feedbackRepository.findDistinctApps(team).toSet()
        }

        call.respond(TeamsAndApps(teams = teamsToApps))
    }
}
