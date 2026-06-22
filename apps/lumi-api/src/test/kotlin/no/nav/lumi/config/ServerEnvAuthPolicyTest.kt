package no.nav.lumi.config

import io.kotest.assertions.throwables.shouldNotThrowAny
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.string.shouldContain

/**
 * The submission-auth bypass must be fail-closed: running outside NAIS (no
 * NAIS_CLUSTER_NAME) disables auth entirely, so it must require an explicit
 * LUMI_LOCAL_AUTH_BYPASS opt-in rather than activating silently.
 */
class ServerEnvAuthPolicyTest : FunSpec({

    test("should refuse to start in local mode when the bypass is not explicitly enabled") {
        val ex = shouldThrow<IllegalStateException> {
            ServerEnv.requireValidLocalAuthPolicy(clusterName = null, localAuthBypass = false)
        }
        ex.message shouldContain "LUMI_LOCAL_AUTH_BYPASS"
    }

    test("should allow local mode when the auth bypass is explicitly enabled") {
        shouldNotThrowAny {
            ServerEnv.requireValidLocalAuthPolicy(clusterName = null, localAuthBypass = true)
        }
    }

    test("should allow NAIS mode regardless of the bypass flag") {
        shouldNotThrowAny {
            ServerEnv.requireValidLocalAuthPolicy(clusterName = "prod-gcp", localAuthBypass = false)
            ServerEnv.requireValidLocalAuthPolicy(clusterName = "dev-gcp", localAuthBypass = false)
        }
    }
})
