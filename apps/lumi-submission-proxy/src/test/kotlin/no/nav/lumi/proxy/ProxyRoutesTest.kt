package no.nav.lumi.proxy

import ch.qos.logback.classic.Logger
import ch.qos.logback.classic.spi.ILoggingEvent
import ch.qos.logback.core.read.ListAppender
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.MockRequestHandler
import io.ktor.client.engine.mock.respond
import io.ktor.client.engine.mock.respondError
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.bearerAuth
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.http.content.OutgoingContent
import io.ktor.http.headersOf
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.testing.testApplication
import io.ktor.utils.io.ByteWriteChannel
import io.ktor.utils.io.writeStringUtf8
import kotlinx.serialization.json.Json
import org.slf4j.LoggerFactory
import java.net.ConnectException
import java.util.concurrent.atomic.AtomicInteger
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

private const val FEEDBACK_PATH = "/api/azure/v1/feedback"
private const val PAYLOAD = """{"schemaVersion":1,"surveyId":"modia","answers":[]}"""

class ProxyRoutesTest {
    private val localConfig = ProxyConfig(
        lumiApiBaseUrl = "http://lumi-api",
        internalSubmissionKey = "test-key",
        tokenIntrospectionEndpoint = null,
        localAuthBypassEnabled = true,
    )
    private val texasConfig = localConfig.copy(
        tokenIntrospectionEndpoint = "http://texas/introspect",
        localAuthBypassEnabled = false,
    )

    @Test
    fun `forwards a submission with Content-Length to lumi-api`() {
        val forwarded = AtomicInteger()
        val status = callProxy(localConfig, texasClient = null, forwarded = forwarded) { client ->
            client.post(FEEDBACK_PATH) {
                contentType(ContentType.Application.Json)
                setBody(PAYLOAD)
            }
        }

        assertEquals(HttpStatusCode.Created, status)
        assertEquals(1, forwarded.get())
    }

    @Test
    fun `answers 411 when Content-Length is missing`() {
        val forwarded = AtomicInteger()
        val status = callProxy(localConfig, texasClient = null, forwarded = forwarded) { client ->
            client.post(FEEDBACK_PATH) {
                setBody(ChunkedJsonBody(PAYLOAD))
            }
        }

        assertEquals(HttpStatusCode.LengthRequired, status)
        assertEquals(0, forwarded.get())
    }

    @Test
    fun `answers 413 when the payload is larger than 1 MB`() {
        val forwarded = AtomicInteger()
        val status = callProxy(localConfig, texasClient = null, forwarded = forwarded) { client ->
            client.post(FEEDBACK_PATH) {
                contentType(ContentType.Application.Json)
                setBody("x".repeat(1_048_577))
            }
        }

        assertEquals(HttpStatusCode.PayloadTooLarge, status)
        assertEquals(0, forwarded.get())
    }

    @Test
    fun `answers 401 when Texas rejects the token`() {
        val texas = mockTexas { texasJson("""{"active": false}""") }
        val status = callProxy(texasConfig, texas) { client -> postWithToken(client) }

        assertEquals(HttpStatusCode.Unauthorized, status)
    }

    @Test
    fun `answers 503 when Texas answers with a 5xx status`() {
        val texas = mockTexas { respondError(HttpStatusCode.InternalServerError) }
        val status = callProxy(texasConfig, texas) { client -> postWithToken(client) }

        assertEquals(HttpStatusCode.ServiceUnavailable, status)
    }

    @Test
    fun `answers 503 when Texas gives an answer that cannot be read, without logging it`() {
        val logger = LoggerFactory.getLogger("LumiSubmissionProxy") as Logger
        val appender = ListAppender<ILoggingEvent>().apply { start() }
        logger.addAppender(appender)
        try {
            val texas = mockTexas { texasJson("""{"active":"ja","azp_name":"dev-gcp:team:app","NAVident":"Z123456"}""") }
            val status = callProxy(texasConfig, texas) { client -> postWithToken(client) }

            assertEquals(HttpStatusCode.ServiceUnavailable, status)
            val logged = appender.list.flatMap { event ->
                listOf(event.formattedMessage) +
                    generateSequence(event.throwableProxy) { it.cause }.map { it.message.orEmpty() }
            }
            assertTrue(logged.any { it.contains("Texas introspection unavailable") })
            assertFalse(logged.any { it.contains("Z123456") })
        } finally {
            logger.detachAppender(appender)
        }
    }

    @Test
    fun `answers 503 when Texas cannot be reached`() {
        val texas = mockTexas { throw ConnectException("Connection refused") }
        val status = callProxy(texasConfig, texas) { client -> postWithToken(client) }

        assertEquals(HttpStatusCode.ServiceUnavailable, status)
    }

    private suspend fun postWithToken(client: HttpClient): HttpResponse =
        client.post(FEEDBACK_PATH) {
            bearerAuth("token-from-modia")
            contentType(ContentType.Application.Json)
            setBody(PAYLOAD)
        }

    private fun callProxy(
        config: ProxyConfig,
        texasClient: TexasClient?,
        forwarded: AtomicInteger = AtomicInteger(),
        request: suspend (HttpClient) -> HttpResponse,
    ): HttpStatusCode {
        val lumiApi = HttpClient(MockEngine {
            forwarded.incrementAndGet()
            respond(
                content = """{"id":"forwarded"}""",
                status = HttpStatusCode.Created,
                headers = headersOf(HttpHeaders.ContentType, ContentType.Application.Json.toString()),
            )
        })
        var status: HttpStatusCode? = null
        testApplication {
            application {
                proxyModule(config = config, texasClient = texasClient, httpClient = lumiApi)
            }
            status = request(client).status
        }
        return status!!
    }

    private fun mockTexas(handler: MockRequestHandler): TexasClient =
        TexasClient(
            introspectionEndpoint = "http://texas/introspect",
            client = HttpClient(MockEngine(handler)) {
                install(ContentNegotiation) {
                    json(Json { ignoreUnknownKeys = true })
                }
            },
        )
}

private fun io.ktor.client.engine.mock.MockRequestHandleScope.texasJson(body: String) =
    respond(
        content = body,
        status = HttpStatusCode.OK,
        headers = headersOf(HttpHeaders.ContentType, ContentType.Application.Json.toString()),
    )

/** A request body without a known length, sent with chunked transfer encoding. */
private class ChunkedJsonBody(private val text: String) : OutgoingContent.WriteChannelContent() {
    override val contentType: ContentType = ContentType.Application.Json

    override suspend fun writeTo(channel: ByteWriteChannel) {
        channel.writeStringUtf8(text)
    }
}
