package no.nav.lumi.routes

import io.ktor.http.HttpStatusCode
import io.ktor.server.resources.get
import io.ktor.server.resources.post
import io.ktor.server.resources.put
import io.ktor.server.application.ApplicationCall
import io.ktor.server.request.receiveChannel
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.utils.io.core.readText
import io.ktor.utils.io.readRemaining
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import no.nav.lumi.config.OpaqueNotFoundResponseKey
import no.nav.lumi.config.auth.authorizedPrincipal
import no.nav.lumi.config.auth.authorizedTeam
import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.domain.PublishAnalysisProductReleaseRequest
import no.nav.lumi.domain.UpdateAnalysisProductDraftRequest
import no.nav.lumi.domain.AnalysisProductDocumentV1
import no.nav.lumi.domain.MAX_ANALYSIS_PRODUCT_DOCUMENT_BYTES
import no.nav.lumi.repository.CreateAnalysisProductResult
import no.nav.lumi.repository.UpdateAnalysisProductDraftResult
import no.nav.lumi.repository.AnalysisProductRepository
import no.nav.lumi.repository.PublishAnalysisProductReleaseResult
import no.nav.lumi.service.AnalysisProductPreviewService
import java.util.UUID

private val defaultAnalysisProductPreviewService = AnalysisProductPreviewService()
private val defaultAnalysisProductRepository = AnalysisProductRepository()
private val releaseRequestJson = Json { ignoreUnknownKeys = false }
private const val MAX_RELEASE_REQUEST_BYTES = 4096L
private const val MAX_DRAFT_REQUEST_BYTES = MAX_ANALYSIS_PRODUCT_DOCUMENT_BYTES + 4096L

fun Route.analysisProductRoutes(
    previewService: AnalysisProductPreviewService = defaultAnalysisProductPreviewService,
    repository: AnalysisProductRepository = defaultAnalysisProductRepository,
) {
    get<ApiV1Intern.AnalysisProducts> {
        call.respond(repository.findByTeam(call.authorizedTeam))
    }

    post<ApiV1Intern.AnalysisProducts> {
        val document = call.receiveAnalysisRequest<AnalysisProductDocumentV1>(MAX_DRAFT_REQUEST_BYTES)
        when (val result = repository.create(call.authorizedTeam, document, call.analysisActor())) {
            is CreateAnalysisProductResult.Created -> call.respond(HttpStatusCode.Created, result.product)
            CreateAnalysisProductResult.LimitReached -> throw ApiErrorException.TooManyRequestsException(
                "Team has reached the analysis product limit",
            )
        }
    }

    get<ApiV1Intern.AnalysisProducts.Id> { params ->
        val productId = runCatching { UUID.fromString(params.productId) }.getOrNull()
        val product = productId?.let { repository.findById(call.authorizedTeam, it) }
        if (product == null) call.analysisProductUnavailable() else call.respond(product)
    }

    put<ApiV1Intern.AnalysisProducts.Id.Draft> { params ->
        val productId = runCatching { UUID.fromString(params.parent.productId) }.getOrNull()
        if (productId == null) {
            call.analysisProductUnavailable()
            return@put
        }
        val request = call.receiveAnalysisRequest<UpdateAnalysisProductDraftRequest>(MAX_DRAFT_REQUEST_BYTES)
        when (val result = repository.updateDraft(
            call.authorizedTeam, productId, UUID.fromString(request.draftId), request.draftRevision,
            request.document, call.analysisActor(),
        )) {
            is UpdateAnalysisProductDraftResult.Updated -> call.respond(result.product)
            UpdateAnalysisProductDraftResult.NotFound -> call.analysisProductUnavailable()
            UpdateAnalysisProductDraftResult.VersionConflict -> call.respond(
                HttpStatusCode.Conflict, mapOf("error" to "ANALYSIS_PREVIEW_CHANGED"),
            )
            UpdateAnalysisProductDraftResult.InvalidLifecycle -> call.respond(
                HttpStatusCode.Conflict, mapOf("error" to "ANALYSIS_PRODUCT_NOT_EDITABLE"),
            )
        }
    }

    get<ApiV1Intern.AnalysisProducts.Catalog> {
        call.respond(previewService.catalog(call.authorizedTeam))
    }

    get<ApiV1Intern.AnalysisProducts.Id.Preview> { params ->
        val productId = runCatching { UUID.fromString(params.parent.productId) }.getOrNull()
        val preview = productId?.let { previewService.preview(call.authorizedTeam, it) }
        if (preview == null) {
            call.analysisProductUnavailable()
        } else {
            call.respond(preview)
        }
    }

    get<ApiV1Intern.AnalysisProducts.Id.Releases> { params ->
        val productId = runCatching { UUID.fromString(params.parent.productId) }.getOrNull()
        val releases = productId?.let { repository.findReleases(call.authorizedTeam, it) }
        if (releases == null) call.analysisProductUnavailable() else call.respond(releases)
    }

    post<ApiV1Intern.AnalysisProducts.Id.Releases> { params ->
        val productId = runCatching { UUID.fromString(params.parent.productId) }.getOrNull()
        if (productId == null) {
            call.analysisProductUnavailable()
            return@post
        }
        // Only preview fingerprints are accepted. In particular, no team,
        // actor, specification, SQL or destination can be supplied in the body.
        val request = call.receiveAnalysisRequest<PublishAnalysisProductReleaseRequest>(MAX_RELEASE_REQUEST_BYTES)
        val actor = call.analysisActor()
        when (val result = repository.publishRelease(call.authorizedTeam, productId, request, actor)) {
            is PublishAnalysisProductReleaseResult.Published -> call.respond(
                if (result.created) HttpStatusCode.Created else HttpStatusCode.OK,
                result.release,
            )
            is PublishAnalysisProductReleaseResult.Blocked -> call.respond(HttpStatusCode.UnprocessableEntity, result.issues)
            PublishAnalysisProductReleaseResult.NotFound -> call.analysisProductUnavailable()
            PublishAnalysisProductReleaseResult.PreviewConflict -> call.respond(
                HttpStatusCode.Conflict, mapOf("error" to "ANALYSIS_PREVIEW_CHANGED"),
            )
            PublishAnalysisProductReleaseResult.InvalidLifecycle -> call.respond(
                HttpStatusCode.Conflict, mapOf("error" to "ANALYSIS_PRODUCT_NOT_EDITABLE"),
            )
        }
    }
}

private suspend inline fun <reified T> ApplicationCall.receiveAnalysisRequest(maxBytes: Long): T {
    val text = receiveChannel().readRemaining(maxBytes + 1).readText()
    if (text.toByteArray(Charsets.UTF_8).size > maxBytes) {
        throw ApiErrorException.PayloadTooLargeException("Analysis product request is too large")
    }
    return try {
        releaseRequestJson.decodeFromString<T>(text)
    } catch (_: SerializationException) {
        throw ApiErrorException.BadRequestException("Invalid analysis product request")
    }
}

private fun ApplicationCall.analysisActor(): String = stablePrincipalIdentity(authorizedPrincipal)
    ?: throw ApiErrorException.BadRequestException("Authenticated user needs a stable identity")

private suspend fun ApplicationCall.analysisProductUnavailable() {
    val unavailable = mapOf("error" to "ANALYSIS_PRODUCT_UNAVAILABLE")
    attributes.put(OpaqueNotFoundResponseKey, unavailable)
    respond(HttpStatusCode.NotFound, unavailable)
}
