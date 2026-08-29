package no.nav.lumi.routes

import io.ktor.http.HttpStatusCode
import io.ktor.server.resources.get
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import no.nav.lumi.config.OpaqueNotFoundResponseKey
import no.nav.lumi.config.auth.authorizedTeam
import no.nav.lumi.service.AnalysisProductPreviewService
import java.util.UUID

private val defaultAnalysisProductPreviewService = AnalysisProductPreviewService()

fun Route.analysisProductRoutes(
    previewService: AnalysisProductPreviewService = defaultAnalysisProductPreviewService,
) {
    get<ApiV1Intern.AnalysisProducts.Catalog> {
        call.respond(previewService.catalog(call.authorizedTeam))
    }

    get<ApiV1Intern.AnalysisProducts.Id.Preview> { params ->
        val productId = runCatching { UUID.fromString(params.parent.productId) }.getOrNull()
        val preview = productId?.let { previewService.preview(call.authorizedTeam, it) }
        if (preview == null) {
            val unavailable = mapOf("error" to "ANALYSIS_PRODUCT_UNAVAILABLE")
            call.attributes.put(OpaqueNotFoundResponseKey, unavailable)
            call.respond(
                HttpStatusCode.NotFound,
                unavailable,
            )
        } else {
            call.respond(preview)
        }
    }
}
