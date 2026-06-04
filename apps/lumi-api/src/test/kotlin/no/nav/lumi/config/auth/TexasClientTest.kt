package no.nav.lumi.config.auth

import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import io.ktor.serialization.kotlinx.json.json
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.serialization.json.Json
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
            activeResponse(exp = fixedClock.instant().epochSecond + 3600)
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
            activeResponse(exp = fixedClock.instant().epochSecond + 3600)
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
            activeResponse(exp = fixedClock.instant().epochSecond + 30)
        }

        client.introspect("token", identityProvider = "entra_id")
        client.introspect("token", identityProvider = "entra_id")

        calls.get() shouldBe 2
    }

    test("does not reuse active result for another token") {
        val calls = AtomicInteger()
        val client = texasClient(calls, fixedClock) {
            activeResponse(exp = fixedClock.instant().epochSecond + 3600)
        }

        client.introspect("token-a", identityProvider = "entra_id")
        client.introspect("token-b", identityProvider = "entra_id")

        calls.get() shouldBe 2
    }

    test("does not reuse active result for another identity provider") {
        val calls = AtomicInteger()
        val client = texasClient(calls, fixedClock) {
            activeResponse(exp = fixedClock.instant().epochSecond + 3600)
        }

        client.introspect("token", identityProvider = "entra_id")
        client.introspect("token", identityProvider = "tokenx")

        calls.get() shouldBe 2
    }

    test("does not cache inactive introspection result") {
        val calls = AtomicInteger()
        val client = texasClient(calls, fixedClock) {
            inactiveResponse()
        }

        client.introspect("token", identityProvider = "entra_id") shouldBe null
        client.introspect("token", identityProvider = "entra_id") shouldBe null

        calls.get() shouldBe 2
    }

    test("exchanges user token through configured Texas endpoint") {
        var observedUrl: String? = null
        val engine = MockEngine { request ->
            observedUrl = request.url.toString()
            respond(
                content = """
                    {
                      "access_token": "obo-token",
                      "expires_in": 3599,
                      "token_type": "Bearer"
                    }
                """.trimIndent(),
                status = HttpStatusCode.OK,
                headers = headersOf(HttpHeaders.ContentType, ContentType.Application.Json.toString()),
            )
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
        val client = TexasClient(
            introspectionEndpoint = "http://texas/introspect",
            tokenExchangeEndpoint = "http://texas/exchange",
            clock = fixedClock,
            client = httpClient,
        )

        val result = client.exchangeToken(
            userToken = "subject-token",
            identityProvider = "entra_id",
            target = "api://dev-gcp.nais-system.nais-api/.default",
        )

        observedUrl shouldBe "http://texas/exchange"
        result?.accessToken shouldBe "obo-token"
        result?.expiresIn shouldBe 3599
        result?.tokenType shouldBe "Bearer"
    }
})

private fun texasClient(
    calls: AtomicInteger,
    fixedClock: Clock,
    responseBody: suspend () -> String,
): TexasClient {
    val engine = MockEngine {
        calls.incrementAndGet()
        respond(
            content = responseBody(),
            status = HttpStatusCode.OK,
            headers = headersOf(HttpHeaders.ContentType, ContentType.Application.Json.toString()),
        )
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
    )
}

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
