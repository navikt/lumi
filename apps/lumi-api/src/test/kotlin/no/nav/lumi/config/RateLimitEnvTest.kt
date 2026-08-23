package no.nav.lumi.config

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe

class RateLimitEnvTest : FunSpec({
    test("global limit defaults to ten thousand requests per source per minute") {
        RateLimitEnv.fromEnvironment(null).globalRequestsPerSourcePerMinute shouldBe 10_000
    }

    test("global limit accepts a positive runtime override") {
        RateLimitEnv.fromEnvironment("20000").globalRequestsPerSourcePerMinute shouldBe 20_000
    }

    test("global limit rejects an invalid runtime override") {
        shouldThrow<IllegalStateException> {
            RateLimitEnv.fromEnvironment("0")
        }
    }
})
