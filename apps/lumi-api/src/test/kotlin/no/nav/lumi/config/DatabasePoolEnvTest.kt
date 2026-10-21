package no.nav.lumi.config

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.ints.shouldBeLessThanOrEqual
import io.kotest.matchers.shouldBe
import java.nio.file.Files
import java.nio.file.Path

class DatabasePoolEnvTest : FunSpec({
    test("pool sizes default to the prod values") {
        DatabasePoolEnv.fromEnvironment(null, null) shouldBe DatabasePoolEnv(8, 4)
        DatabasePoolEnv.default().connectionsPerPod shouldBe 13
    }

    test("pool sizes accept runtime overrides") {
        DatabasePoolEnv.fromEnvironment("4", "2") shouldBe DatabasePoolEnv(4, 2)
    }

    test("pool sizes reject values below the idle connections") {
        shouldThrow<IllegalStateException> { DatabasePoolEnv.fromEnvironment("1", null) }
        shouldThrow<IllegalStateException> { DatabasePoolEnv.fromEnvironment(null, "fire") }
    }

    // Cloud SQL sets max_connections from the instance memory, and Postgres
    // keeps three of them for superusers. A rolling deploy adds one pod.
    for (environment in listOf("dev", "prod")) {
        test("$environment stays within the database connection limit during a deploy") {
            val manifest = Files.readString(Path.of("nais/app/$environment.yaml"))
            val maxReplicas = manifest.capture("""replicas:\s*\n\s*min: \d+\s*\n\s*max: (\d+)""").toInt()
            val tier = manifest.capture("""tier: (\S+)""")
            val pools = DatabasePoolEnv.fromEnvironment(
                manifest.namedValue(DatabasePoolEnv.MAIN_POOL_SIZE_ENV),
                manifest.namedValue(DatabasePoolEnv.SUBMISSION_POOL_SIZE_ENV),
            )
            val maxConnections = manifest.namedValue("max_connections")?.toInt()
                ?: DEFAULT_MAX_CONNECTIONS[tier]
                ?: error("Add the default max_connections for $tier from the Cloud SQL docs")

            withClue("$environment: ${maxReplicas + 1} pods × ${pools.connectionsPerPod} connections") {
                (maxReplicas + 1) * pools.connectionsPerPod shouldBeLessThanOrEqual
                    maxConnections - SUPERUSER_RESERVED_CONNECTIONS
            }
        }
    }
})

private const val SUPERUSER_RESERVED_CONNECTIONS = 3

// Default max_connections by memory: https://cloud.google.com/sql/docs/postgres/flags
private val DEFAULT_MAX_CONNECTIONS = mapOf(
    "db-f1-micro" to 25,
    "db-custom-1-3840" to 100,
)

private fun String.capture(pattern: String): String =
    Regex(pattern).find(this)?.groupValues?.get(1) ?: error("No match for $pattern")

// Env vars and database flags have the same shape in the manifest.
private fun String.namedValue(name: String): String? =
    Regex("""- name: "?$name"?\s*\n\s*value: "?([^"\n]+)"?""").find(this)?.groupValues?.get(1)
