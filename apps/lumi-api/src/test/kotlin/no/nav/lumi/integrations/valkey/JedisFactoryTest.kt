package no.nav.lumi.integrations.valkey

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import redis.clients.jedis.HostAndPort
import redis.clients.jedis.SslVerifyMode

class JedisFactoryTest : FunSpec({
    test("configures Valkey TLS with hostname verification and URI database") {
        val config = JedisFactory.createConnectionConfig(
            uri = "valkeys://cache.example.nav:6380/2",
            username = "cache-user",
            password = "secret",
        )

        config.hostAndPort shouldBe HostAndPort("cache.example.nav", 6380)
        config.clientConfig.database shouldBe 2
        config.clientConfig.user shouldBe "cache-user"
        config.clientConfig.password shouldBe "secret"
        config.clientConfig.sslOptions shouldNotBe null
        config.clientConfig.sslOptions.sslVerifyMode shouldBe SslVerifyMode.FULL
        config.clientConfig.isAutoNegotiateProtocol shouldBe true
        config.clientConfig.redisProtocol.shouldBeNull()
    }

    test("keeps plain Valkey connections non-TLS with the default port") {
        val config = JedisFactory.createConnectionConfig(
            uri = "valkey://localhost",
            username = null,
            password = null,
        )

        config.hostAndPort shouldBe HostAndPort("localhost", 6379)
        config.clientConfig.sslOptions.shouldBeNull()
        config.clientConfig.database shouldBe 0
    }
})
