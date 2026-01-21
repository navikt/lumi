package no.nav.lumi.integrations.valkey

import redis.clients.jedis.DefaultJedisClientConfig
import redis.clients.jedis.HostAndPort
import redis.clients.jedis.JedisPool
import redis.clients.jedis.JedisPoolConfig
import java.net.URI
import java.time.Duration

internal object JedisFactory {
    private val defaultConnectionTimeout: Duration = Duration.ofSeconds(2)
    private val defaultSocketTimeout: Duration = Duration.ofSeconds(2)

    fun createPool(
        uri: String,
        username: String?,
        password: String?,
    ): JedisPool {
        val normalizedUri = uri
            .replace("valkey://", "redis://")
            .replace("valkeys://", "rediss://")

        val parsed = URI(normalizedUri)
        val host = requireNotNull(parsed.host) { "Valkey URI must include host" }

        val ssl = parsed.scheme.equals("rediss", ignoreCase = true)
        val port = if (parsed.port != -1) parsed.port else 6379

        val dbIndex = parsed.path
            ?.trim()
            ?.trim('/')
            ?.takeIf { it.isNotBlank() }
            ?.toIntOrNull()

        val clientConfig = DefaultJedisClientConfig.builder()
            .ssl(ssl)
            .connectionTimeoutMillis(defaultConnectionTimeout.toMillis().toInt())
            .socketTimeoutMillis(defaultSocketTimeout.toMillis().toInt())
            .apply {
                if (!username.isNullOrBlank()) user(username)
                if (!password.isNullOrBlank()) password(password)
                if (dbIndex != null) database(dbIndex)
            }
            .build()

        val poolConfig = JedisPoolConfig().apply {
            // Validate connections to avoid stale sockets ("Broken pipe") after idle.
            testOnBorrow = true
            testWhileIdle = true
            timeBetweenEvictionRuns = Duration.ofMinutes(1)
            minEvictableIdleDuration = Duration.ofMinutes(5)
        }

        return JedisPool(poolConfig, HostAndPort(host, port), clientConfig)
    }
}
