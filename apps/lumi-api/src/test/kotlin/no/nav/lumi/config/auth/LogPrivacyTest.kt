package no.nav.lumi.config.auth

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe

class LogPrivacyTest : FunSpec({
    test("pseudonymizeIdentifier returns none for blank values") {
        pseudonymizeIdentifier(null) shouldBe "none"
        pseudonymizeIdentifier("") shouldBe "none"
        pseudonymizeIdentifier("   ") shouldBe "none"
    }

    test("pseudonymizeIdentifier is deterministic and does not expose raw identifier") {
        val first = pseudonymizeIdentifier("Z123456")
        val second = pseudonymizeIdentifier("Z123456")

        first shouldBe second
        first.startsWith("id:") shouldBe true
        first.contains("Z123456") shouldBe false
    }

    test("summarizeClientId extracts team and app") {
        summarizeClientId("dev-gcp:team-esyfo:lumi-dashboard") shouldBe "team=team-esyfo,app=lumi-dashboard"
    }

    test("summarizeClientId handles invalid format") {
        summarizeClientId("invalid") shouldBe "unknown-client"
        summarizeClientId(null) shouldBe "unknown-client"
    }
})
