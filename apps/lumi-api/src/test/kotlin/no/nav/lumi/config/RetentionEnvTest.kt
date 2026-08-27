package no.nav.lumi.config

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe

class RetentionEnvTest : FunSpec({
    test("is fail-closed when the environment value is missing") {
        RetentionEnv.fromEnvironment(null) shouldBe RetentionEnv(enabled = false)
    }

    test("accepts explicit boolean environment values case-insensitively") {
        RetentionEnv.fromEnvironment("TRUE") shouldBe RetentionEnv(enabled = true)
        RetentionEnv.fromEnvironment("false") shouldBe RetentionEnv(enabled = false)
    }

    test("rejects ambiguous environment values") {
        shouldThrow<IllegalStateException> {
            RetentionEnv.fromEnvironment("yes")
        }.message shouldBe "LUMI_RETENTION_ENABLED must be 'true' or 'false'"
    }
})
