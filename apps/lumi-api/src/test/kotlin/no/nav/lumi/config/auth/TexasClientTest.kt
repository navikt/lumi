package no.nav.lumi.config.auth

import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respondError
import io.ktor.client.engine.mock.respond
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import io.ktor.serialization.kotlinx.json.json
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.micrometer.core.instrument.MeterRegistry
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import kotlinx.coroutines.async
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.serialization.json.Json
import java.net.SocketException
import java.net.SocketTimeoutException
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.concurrent.atomic.AtomicInteger

class TexasClientTest : FunSpec({
    val fixedClock: Clock = Clock.fixed(
        Instant.parse("2026-06-03T10:00:00Z"),
        ZoneOffset.UTC,
    )

    test("reuses active introspection result while token is valid") {
        val calls = AtomicInteger()
        val client = texasClient(calls, fixedClock) {
            jsonReply(activeResponse(exp = fixedClock.instant().epochSecond + 3600))
        }

        val first = client.introspect("token", identityProvider = "entra_id")
        val second = client.introspect("token", identityProvider = "entra_id")

        first?.NAVident shouldBe "Z123456"
        second shouldBe first
        calls.get() shouldBe 1
    }

    test("deduplicates concurrent introspection requests for the same token") {
        val calls = AtomicInteger()
        val client = texasClient(calls, fixedClock) {
            delay(25)
            jsonReply(activeResponse(exp = fixedClock.instant().epochSecond + 3600))
        }

        coroutineScope {
            val first = async { client.introspect("token", identityProvider = "entra_id") }
            val second = async { client.introspect("token", identityProvider = "entra_id") }

            first.await()?.NAVident shouldBe "Z123456"
            second.await()?.NAVident shouldBe "Z123456"
        }
        calls.get() shouldBe 1
    }

    test("does not cache introspection result inside expiry skew") {
        val calls = AtomicInteger()
        val client = texasClient(calls, fixedClock) {
            jsonReply(activeResponse(exp = fixedClock.instant().epochSecond + 30))
        }

        client.introspect("token", identityProvider = "entra_id")
        client.introspect("token", identityProvider = "entra_id")

        calls.get() shouldBe 2
    }

    test("does not reuse active result for another token") {
        val calls = AtomicInteger()
        val client = texasClient(calls, fixedClock) {
            jsonReply(activeResponse(exp = fixedClock.instant().epochSecond + 3600))
        }

        client.introspect("token-a", identityProvider = "entra_id")
        client.introspect("token-b", identityProvider = "entra_id")

        calls.get() shouldBe 2
    }

    test("does not reuse active result for another identity provider") {
        val calls = AtomicInteger()
        val client = texasClient(calls, fixedClock) {
            jsonReply(activeResponse(exp = fixedClock.instant().epochSecond + 3600))
        }

        client.introspect("token", identityProvider = "entra_id")
        client.introspect("token", identityProvider = "tokenx")

        calls.get() shouldBe 2
    }

    test("does not cache inactive introspection result") {
        val calls = AtomicInteger()
        val client = texasClient(calls, fixedClock) {
            jsonReply(inactiveResponse())
        }

        client.introspect("token", identityProvider = "entra_id") shouldBe null
        client.introspect("token", identityProvider = "entra_id") shouldBe null

        calls.get() shouldBe 2
    }

    test("retries once on transient transport timeout before succeeding") {
        val calls = AtomicInteger()
        val meterRegistry = SimpleMeterRegistry()
        val client = texasClient(calls, fixedClock, meterRegistry) {
            if (calls.get() == 1) {
                throw SocketTimeoutException("read timed out")
            }
            jsonReply(activeResponse(exp = fixedClock.instant().epochSecond + 3600))
        }

        val result = client.introspect("token", identityProvider = "entra_id")

        result?.NAVident shouldBe "Z123456"
        calls.get() shouldBe 2
        meterRegistry.get("texas_introspection_errors_total").counter().count() shouldBe 0.0
    }

    test("retries once on connection reset like transport failure before succeeding") {
        val calls = AtomicInteger()
        val client = texasClient(calls, fixedClock) {
            if (calls.get() == 1) {
                throw SocketException("Connection reset")
            }
            jsonReply(activeResponse(exp = fixedClock.instant().epochSecond + 3600))
        }

        val result = client.introspect("token", identityProvider = "entra_id")

        result?.NAVident shouldBe "Z123456"
        calls.get() shouldBe 2
    }

    test("does not retry semantic auth rejection when texas returns unauthorized") {
        val calls = AtomicInteger()
        val client = texasClient(calls, fixedClock) {
            statusReply(HttpStatusCode.Unauthorized)
        }

        client.introspect("token", identityProvider = "entra_id") shouldBe null

        calls.get() shouldBe 1
    }

    test("does not retry semantic auth rejection when texas returns inactive token") {
        val calls = AtomicInteger()
        val client = texasClient(calls, fixedClock) {
            jsonReply(inactiveResponse())
        }

        client.introspect("token", identityProvider = "entra_id") shouldBe null

        calls.get() shouldBe 1
    }

    test("propagates coroutine cancellation without retrying") {
        val calls = AtomicInteger()
        val meterRegistry = SimpleMeterRegistry()
        val client = texasClient(calls, fixedClock, meterRegistry) {
            throw CancellationException("cancelled")
        }

        shouldThrow<CancellationException> {
            client.introspect("token", identityProvider = "entra_id")
        }

        calls.get() shouldBe 1
        meterRegistry.get("texas_introspection_errors_total").counter().count() shouldBe 0.0
    }

    test("does not retry non-transient introspection exceptions and counts one final error") {
        val calls = AtomicInteger()
        val meterRegistry = SimpleMeterRegistry()
        val client = texasClient(calls, fixedClock, meterRegistry) {
            throw IllegalStateException("boom")
        }

        client.introspect("token", identityProvider = "entra_id") shouldBe null

        calls.get() shouldBe 1
        meterRegistry.get("texas_introspection_errors_total").counter().count() shouldBe 1.0
    }

    test("reuses http meters for repeated introspection with the same tags") {
        val calls = AtomicInteger()
        val meterRegistry = SimpleMeterRegistry()
        val client = texasClient(
            calls = calls,
            fixedClock = fixedClock,
            meterRegistry = meterRegistry,
        ) {
            jsonReply(activeResponse(exp = fixedClock.instant().epochSecond + 3600))
        }

        client.introspect("token-a", identityProvider = "entra_id")
        client.introspect("token-b", identityProvider = "entra_id")

        calls.get() shouldBe 2
        meterRegistry.find("texas_introspection_http_duration_seconds")
            .tags("identity_provider", "entra_id", "status", "200", "outcome", "active")
            .timers()
            .size shouldBe 1
        meterRegistry.find("texas_introspection_http_requests_total")
            .tags("identity_provider", "entra_id", "status", "200", "outcome", "active")
            .counter()
            ?.count() shouldBe 2.0
    }

})

private fun texasClient(
    calls: AtomicInteger,
    fixedClock: Clock,
    meterRegistry: MeterRegistry = SimpleMeterRegistry(),
    handler: suspend () -> MockTexasReply,
): TexasClient {
    val engine = MockEngine {
        calls.incrementAndGet()
        val reply = handler()
        if (reply.body == null) {
            respondError(reply.status)
        } else {
            respond(
                content = reply.body,
                status = reply.status,
                headers = headersOf(HttpHeaders.ContentType, ContentType.Application.Json.toString()),
            )
        }
    }
    val httpClient = HttpClient(engine) {
        install(ContentNegotiation) {
            json(Json {
                ignoreUnknownKeys = true
                isLenient = true
                encodeDefaults = true
            })
        }
    }

    return TexasClient(
        introspectionEndpoint = "http://texas/introspect",
        clock = fixedClock,
        client = httpClient,
        meterRegistry = meterRegistry,
    )
}

private data class MockTexasReply(
    val status: HttpStatusCode,
    val body: String? = null,
)

private fun jsonReply(content: String): MockTexasReply = MockTexasReply(
    status = HttpStatusCode.OK,
    body = content,
)

private fun statusReply(status: HttpStatusCode): MockTexasReply = MockTexasReply(status = status)

private fun activeResponse(exp: Long): String = """
    {
      "active": true,
      "NAVident": "Z123456",
      "name": "Test User",
      "preferred_username": "test@nav.no",
      "azp_name": "prod-gcp:team-esyfo:lumi-dashboard",
      "groups": [],
      "exp": $exp
    }
""".trimIndent()

private fun inactiveResponse(): String = """
    {
      "active": false
    }
""".trimIndent()
