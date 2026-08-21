package no.nav.lumi.integrations.valkey

import redis.clients.jedis.ConnectionPoolConfig
import redis.clients.jedis.DefaultJedisClientConfig
import redis.clients.jedis.HostAndPort
import redis.clients.jedis.RedisClient
import redis.clients.jedis.SslOptions
import java.net.URI
import java.time.Duration

internal data class JedisConnectionConfig(
    val hostAndPort: HostAndPort,
    val clientConfig: DefaultJedisClientConfig,
)

internal object JedisFactory {
    private val defaultConnectionTimeout: Duration = Duration.ofSeconds(2)
    private val defaultSocketTimeout: Duration = Duration.ofSeconds(2)

    fun createClient(
        uri: String,
        username: String?,
        password: String?,
    ): RedisClient {
        val connectionConfig = createConnectionConfig(uri, username, password)

        val poolConfig = ConnectionPoolConfig().apply {
            // Validate connections to avoid stale sockets ("Broken pipe") after idle.
            testOnBorrow = true
            testWhileIdle = true
            timeBetweenEvictionRuns = Duration.ofMinutes(1)
            minEvictableIdleDuration = Duration.ofMinutes(5)
        }

        return RedisClient.builder()
            .hostAndPort(connectionConfig.hostAndPort)
            .clientConfig(connectionConfig.clientConfig)
            .poolConfig(poolConfig)
            .build()
    }

    internal fun createConnectionConfig(
        uri: String,
        username: String?,
        password: String?,
    ): JedisConnectionConfig {
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
            .connectionTimeoutMillis(defaultConnectionTimeout.toMillis().toInt())
            .socketTimeoutMillis(defaultSocketTimeout.toMillis().toInt())
            .apply {
                if (ssl) sslOptions(SslOptions.defaults())
                if (!username.isNullOrBlank()) user(username)
                if (!password.isNullOrBlank()) password(password)
                if (dbIndex != null) database(dbIndex)
            }
            .build()

        return JedisConnectionConfig(HostAndPort(host, port), clientConfig)
    }
}
