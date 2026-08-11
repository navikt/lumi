package no.nav.lumi.routes

import io.ktor.http.HttpStatusCode
import io.ktor.server.resources.delete
import io.ktor.server.resources.put
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import no.nav.lumi.config.auth.authorizedPrincipal
import no.nav.lumi.config.auth.authorizedTeam
import no.nav.lumi.integrations.valkey.StringCache
import no.nav.lumi.repository.SurveyMetadataRepository
import no.nav.lumi.service.StatsCacheInvalidator

private val defaultSurveyMetadataRepository = SurveyMetadataRepository()
private val defaultArchiveStatsCacheInvalidator = StatsCacheInvalidator()

/**
 * Archive/restore surveys (team-scoped display metadata).
 *
 * Archiving only affects what the dashboard shows — it does not stop
 * submissions, which are controlled by the consuming app's frontend.
 */
fun Route.surveyArchiveRoutes(
    surveyMetadataRepository: SurveyMetadataRepository = defaultSurveyMetadataRepository,
    bootstrapCache: StringCache = sharedBootstrapCache,
    statsCacheInvalidator: StatsCacheInvalidator = defaultArchiveStatsCacheInvalidator,
) {
    val versionedBootstrapCache = VersionedBootstrapCache(bootstrapCache)

    put<ApiV1Intern.Surveys.Id.Archive> { params ->
        val team = call.authorizedTeam
        val archivedBy = stablePrincipalIdentity(call.authorizedPrincipal)

        val state = surveyMetadataRepository.archive(
            team = team,
            surveyId = params.parent.surveyId,
            archivedBy = archivedBy,
        )
        versionedBootstrapCache.invalidate(team)
        statsCacheInvalidator.invalidateTeam(team)
        call.respond(state)
    }

    delete<ApiV1Intern.Surveys.Id.Archive> { params ->
        val team = call.authorizedTeam

        surveyMetadataRepository.unarchive(team = team, surveyId = params.parent.surveyId)
        versionedBootstrapCache.invalidate(team)
        statsCacheInvalidator.invalidateTeam(team)
        call.respond(HttpStatusCode.NoContent)
    }
}
