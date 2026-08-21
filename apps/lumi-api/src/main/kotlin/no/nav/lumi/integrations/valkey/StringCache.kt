package no.nav.lumi.integrations.valkey

import io.micrometer.core.instrument.Counter
import io.micrometer.core.instrument.Timer
import no.nav.lumi.config.ServerEnv
import no.nav.lumi.config.appMicrometerRegistry
import org.slf4j.LoggerFactory
import redis.clients.jedis.RedisClient
import redis.clients.jedis.exceptions.JedisConnectionException
import redis.clients.jedis.params.SetParams
import java.time.Duration
import java.util.concurrent.ConcurrentHashMap

private val log = LoggerFactory.getLogger("StringCache")

/**
 * Simple key/value cache for small string payloads (typically JSON).
 * Implemented with Valkey (Redis) when configured, otherwise in-memory.
 */
interface StringCache {
    fun get(key: String): String?
    fun set(key: String, value: String, ttl: Duration)
    fun increment(key: String): Long
    fun isHealthy(): Boolean
    fun clear()
    fun clearByPrefix(prefix: String)
}

class InMemoryStringCache : StringCache {
    private data class CacheEntry(val expiresAt: Long, val value: String)

    private val cache = ConcurrentHashMap<String, CacheEntry>()

    override fun get(key: String): String? {
        val entry = cache[key] ?: return null
        if (System.currentTimeMillis() > entry.expiresAt) {
            cache.remove(key)
            return null
        }
        return entry.value
    }

    override fun set(key: String, value: String, ttl: Duration) {
        val expiresAt = System.currentTimeMillis() + ttl.toMillis()
        cache[key] = CacheEntry(expiresAt, value)
    }

    override fun increment(key: String): Long {
        var incrementedValue = 0L
        cache.compute(key) { _, entry ->
            val currentValue = entry
                ?.takeIf { System.currentTimeMillis() <= it.expiresAt }
                ?.value
                ?.toLongOrNull()
                ?: 0L
            incrementedValue = currentValue + 1
            CacheEntry(Long.MAX_VALUE, incrementedValue.toString())
        }
        return incrementedValue
    }

    override fun isHealthy(): Boolean = true

    override fun clear() {
        cache.clear()
        log.info("In-memory string cache cleared")
    }

    override fun clearByPrefix(prefix: String) {
        cache.keys.removeAll { it.startsWith(prefix) }
    }
}

class ValkeyStringCache private constructor(
    private val redisClient: RedisClient,
    private val keyPrefix: String,
    private val fallback: InMemoryStringCache = InMemoryStringCache()
) : StringCache {

    private val cacheHitCounter = Counter.builder("string_cache_hits_total")
        .description("Number of string cache hits")
        .register(appMicrometerRegistry)

    private val cacheMissCounter = Counter.builder("string_cache_misses_total")
        .description("Number of string cache misses")
        .register(appMicrometerRegistry)

    private val cacheErrorCounter = Counter.builder("string_cache_errors_total")
        .description("Number of string cache errors")
        .register(appMicrometerRegistry)

    private val cacheOperationTimer = Timer.builder("string_cache_operation_seconds")
        .description("Duration of string cache operations")
        .register(appMicrometerRegistry)

    override fun get(key: String): String? {
        val fullKey = keyPrefix + key

        return try {
            val startTime = System.nanoTime()
            val value = redisClient.get(fullKey)
            cacheOperationTimer.record(Duration.ofNanos(System.nanoTime() - startTime))

            if (value.isNullOrEmpty()) {
                cacheMissCounter.increment()
                fallback.get(key)
            } else {
                cacheHitCounter.increment()
                value
            }
        } catch (e: JedisConnectionException) {
            cacheErrorCounter.increment()
            log.warn("Failed to get from Valkey string cache, using fallback", e)
            fallback.get(key)
        } catch (e: Exception) {
            cacheErrorCounter.increment()
            log.warn("Unexpected error getting from Valkey string cache", e)
            fallback.get(key)
        }
    }

    override fun set(key: String, value: String, ttl: Duration) {
        val fullKey = keyPrefix + key

        try {
            val startTime = System.nanoTime()
            redisClient.set(fullKey, value, SetParams.setParams().ex(ttl.seconds))
            cacheOperationTimer.record(Duration.ofNanos(System.nanoTime() - startTime))
        } catch (e: JedisConnectionException) {
            cacheErrorCounter.increment()
            log.warn("Failed to set in Valkey string cache, using fallback", e)
            fallback.set(key, value, ttl)
        } catch (e: Exception) {
            cacheErrorCounter.increment()
            log.warn("Unexpected error setting in Valkey string cache", e)
            fallback.set(key, value, ttl)
        }
    }

    override fun increment(key: String): Long {
        val fullKey = keyPrefix + key

        return try {
            val startTime = System.nanoTime()
            val value = redisClient.incr(fullKey)
            cacheOperationTimer.record(Duration.ofNanos(System.nanoTime() - startTime))
            value
        } catch (e: JedisConnectionException) {
            cacheErrorCounter.increment()
            log.warn("Failed to increment in Valkey string cache, using fallback", e)
            fallback.increment(key)
        } catch (e: Exception) {
            cacheErrorCounter.increment()
            log.warn("Unexpected error incrementing in Valkey string cache", e)
            fallback.increment(key)
        }
    }

    override fun isHealthy(): Boolean {
        return try {
            redisClient.ping() == "PONG"
        } catch (e: Exception) {
            false
        }
    }

    override fun clear() {
        try {
            val keys = redisClient.keys("${keyPrefix}*")
            if (keys.isNotEmpty()) {
                redisClient.del(*keys.toTypedArray())
            }
            fallback.clear()
            log.info("Valkey string cache cleared (${keys.size} keys)")
        } catch (e: Exception) {
            log.warn("Failed to clear Valkey string cache", e)
            fallback.clear()
        }
    }

    override fun clearByPrefix(prefix: String) {
        try {
            val keys = redisClient.keys("$keyPrefix$prefix*")
            if (keys.isNotEmpty()) {
                redisClient.del(*keys.toTypedArray())
            }
            fallback.clearByPrefix(prefix)
        } catch (e: Exception) {
            cacheErrorCounter.increment()
            log.warn("Failed to clear Valkey string cache by prefix", e)
            fallback.clearByPrefix(prefix)
        }
    }

    companion object {
        /**
         * Create a ValkeyStringCache from NAIS environment variables.
         * Returns InMemoryStringCache if Valkey is not configured.
         */
        fun fromEnvOrFallback(keyPrefix: String): StringCache {
            val valkeyEnv = ServerEnv.current.valkey
            val uri = valkeyEnv.uri

            if (uri.isNullOrBlank()) {
                log.info("Valkey not configured for string cache, using in-memory cache")
                return InMemoryStringCache()
            }

            val username = valkeyEnv.username
            val password = valkeyEnv.password

            return try {
                val redisClient = JedisFactory.createClient(uri = uri, username = username, password = password)
                redisClient.ping()
                log.info("Valkey string cache connected successfully")
                ValkeyStringCache(redisClient, keyPrefix)
            } catch (e: Exception) {
                log.error("Failed to connect to Valkey for string cache, using in-memory fallback", e)
                InMemoryStringCache()
            }
        }
    }
}
