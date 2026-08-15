package no.nav.lumi.config

import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.plugins.ratelimit.*
import io.ktor.server.routing.*
import no.nav.lumi.config.auth.ClientAuthorizationPlugin
import no.nav.lumi.config.auth.TeamAuthorizationPlugin
import no.nav.lumi.routes.discoveryRoutes
import no.nav.lumi.routes.feedbackRoutes
import no.nav.lumi.routes.exportRoutes
import no.nav.lumi.routes.filterRoutes
import no.nav.lumi.routes.markerRoutes
import no.nav.lumi.routes.surveyArchiveRoutes
import no.nav.lumi.routes.surveyFacetRoutes
import no.nav.lumi.routes.statsRoutes
import no.nav.lumi.routes.internalRoutes
import no.nav.lumi.routes.internalSubmissionRoutes
import no.nav.lumi.routes.submissionRoutes
import no.nav.lumi.routes.teamsRoutes

fun Application.configureRouting() {
    install(io.ktor.server.resources.Resources)
    routing {
        // Health checks - no auth
        internalRoutes()
        
        // Internal proxy-forwarded submissions (dev only, PSK-protected)
        rateLimit(SubmissionRateLimit) {
            internalSubmissionRoutes()
        }
        
        // Public submission API - issuer-specific endpoints (/api/tokenx/* and /api/azure/*)
        submissionRoutes()
        
        // Analytics API is browser-facing (dashboard) and needs CORS.
        // CORS is scoped here so server-to-server submission routes are not
        // affected by forwarded Origin headers from calling apps.
        createChild(CorsScopeSelector).apply {
            installCors()

            protectedAnalyticsRoutes {
                rateLimit(AnalyticsRateLimit) {
                    filterRoutes()
                    feedbackRoutes()
                    surveyFacetRoutes()
                    surveyArchiveRoutes()
                    markerRoutes()
                    statsRoutes()
                    discoveryRoutes()
                    teamsRoutes()
                }
            }

            rateLimitRejectedExportAuthentication {
                protectedAnalyticsRoutes(refundRejectedExportReservation = true) {
                    rateLimit(ExportRateLimit) {
                        exportRoutes()
                    }
                }
            }
        }
    }
}

private fun Route.protectedAnalyticsRoutes(
    refundRejectedExportReservation: Boolean = false,
    build: Route.() -> Unit,
): Route =
    authenticate(AZURE_REALM) {
        install(ClientAuthorizationPlugin) {
            allowedClientId = getDashboardClientId()
        }
        install(TeamAuthorizationPlugin)
        if (refundRejectedExportReservation) {
            refundRejectedExportAuthenticationAfterAuthorization()
        }
        build()
    }

/**
 * Transparent route selector used to scope CORS to analytics routes only.
 * Does not consume path segments — child routes keep their original paths.
 */
private object CorsScopeSelector : RouteSelector() {
    override suspend fun evaluate(context: RoutingResolveContext, segmentIndex: Int) =
        RouteSelectorEvaluation.Transparent

    override fun toString() = "(cors-scope)"
}
