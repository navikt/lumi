package no.nav.lumi.config

import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.routing.*
import no.nav.lumi.config.auth.ClientAuthorizationPlugin
import no.nav.lumi.config.auth.TeamAuthorizationPlugin
import no.nav.lumi.routes.discoveryRoutes
import no.nav.lumi.routes.feedbackRoutes
import no.nav.lumi.routes.exportRoutes
import no.nav.lumi.routes.filterRoutes
import no.nav.lumi.routes.surveyFacetRoutes
import no.nav.lumi.routes.statsRoutes
import no.nav.lumi.routes.internalRoutes
import no.nav.lumi.routes.submissionRoutes
import no.nav.lumi.routes.teamsRoutes

fun Application.configureRouting() {
    install(io.ktor.server.resources.Resources)
    routing {
        // Health checks - no auth
        internalRoutes()
        
        // Public submission API - issuer-specific endpoints (/api/tokenx/* and /api/azure/*)
        submissionRoutes()
        
        // Protected analytics API - requires Azure AD from frontend
        authenticate(AZURE_REALM) {
            // Validate that caller is the allowed lumi-dashboard frontend
            install(ClientAuthorizationPlugin) {
                allowedClientId = getDashboardClientId()
            }
            
            // Enforce team authorization based on user's AD groups
            install(TeamAuthorizationPlugin)
            
            filterRoutes()
            feedbackRoutes()
            surveyFacetRoutes()
            statsRoutes()
            exportRoutes()
            discoveryRoutes()
            teamsRoutes()
        }
    }
}

