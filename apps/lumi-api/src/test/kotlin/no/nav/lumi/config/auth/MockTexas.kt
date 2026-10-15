package no.nav.lumi.config.auth

import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.MockRequestHandleScope
import io.ktor.client.engine.mock.respond
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.HttpRequestData
import io.ktor.client.request.HttpResponseData
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import io.ktor.serialization.kotlinx.json.json
import io.micrometer.core.instrument.MeterRegistry
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import kotlinx.serialization.json.Json

/**
 * A [TexasClient] whose sidecar is replaced by [handler], so auth code can be
 * tested for both rejected tokens and an unavailable Texas.
 */
internal fun mockTexasClient(
    meterRegistry: MeterRegistry = SimpleMeterRegistry(),
    handler: suspend MockRequestHandleScope.(HttpRequestData) -> HttpResponseData,
): TexasClient {
    val httpClient = HttpClient(MockEngine(handler)) {
        install(ContentNegotiation) {
            json(Json { ignoreUnknownKeys = true })
        }
    }
    return TexasClient(
        introspectionEndpoint = "http://texas/introspect",
        client = httpClient,
        meterRegistry = meterRegistry,
    )
}

internal fun MockRequestHandleScope.texasJson(body: String, status: HttpStatusCode = HttpStatusCode.OK) =
    respond(
        content = body,
        status = status,
        headers = headersOf(HttpHeaders.ContentType, ContentType.Application.Json.toString()),
    )
