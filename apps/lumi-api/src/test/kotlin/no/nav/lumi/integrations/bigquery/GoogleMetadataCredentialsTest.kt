package no.nav.lumi.integrations.bigquery

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.http.HttpStatusCode
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset

class GoogleMetadataCredentialsTest : FunSpec({
    class MutableClock(var now: Instant) : Clock() {
        override fun getZone() = ZoneOffset.UTC
        override fun withZone(zone: java.time.ZoneId?) = this
        override fun instant() = now
    }

    test("caches the token until shortly before it expires and always sends the metadata header") {
        var calls = 0
        val clock = MutableClock(Instant.parse("2026-10-20T10:00:00Z"))
        val credentials = GoogleMetadataCredentials(
            client = HttpClient(MockEngine { request ->
                request.headers["Metadata-Flavor"] shouldBe "Google"
                calls += 1
                respond("""{"access_token":"token-$calls","expires_in":3600,"token_type":"Bearer"}""")
            }),
            clock = clock,
        )

        credentials.accessToken() shouldBe "token-1"
        credentials.accessToken() shouldBe "token-1"
        clock.now = clock.now.plusSeconds(3600 - 30)
        credentials.accessToken() shouldBe "token-2"
        calls shouldBe 2

        credentials.invalidate()
        credentials.accessToken() shouldBe "token-3"
    }

    test("fails clearly without a token and returns no email outside Google Cloud") {
        val credentials = GoogleMetadataCredentials(
            client = HttpClient(MockEngine { respond("", HttpStatusCode.NotFound) }),
        )

        shouldThrow<IllegalStateException> { credentials.accessToken() }
        credentials.serviceAccountEmail().shouldBeNull()
    }

    test("reads the service account email") {
        val credentials = GoogleMetadataCredentials(
            client = HttpClient(MockEngine { respond("lumi-api-team-esyfo-1@nais-prod.iam.gserviceaccount.com\n") }),
        )

        credentials.serviceAccountEmail() shouldBe "lumi-api-team-esyfo-1@nais-prod.iam.gserviceaccount.com"
    }
})
