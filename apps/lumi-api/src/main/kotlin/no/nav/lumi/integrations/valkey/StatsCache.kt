package no.nav.lumi.integrations.valkey

import io.micrometer.core.instrument.Counter
import io.micrometer.core.instrument.Timer
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import no.nav.lumi.config.ServerEnv
import no.nav.lumi.config.appMicrometerRegistry
import org.slf4j.LoggerFactory
import redis.clients.jedis.JedisPool
import redis.clients.jedis.exceptions.JedisConnectionException
import java.time.Duration
import java.util.concurrent.ConcurrentHashMap

private val log = LoggerFactory.getLogger("StatsCache")

/**
 * Cache interface for stats data.
 * Abstracts the caching layer to allow Valkey or in-memory fallback.
 */
interface StatsCache {
    /**
     * Get cached stats for a cache key.
     * Returns null if not cached.
     */
    fun get(key: String): String?
    
    /**
     * Cache stats JSON with the given TTL.
     */
    fun set(key: String, jsonValue: String, ttl: Duration = Duration.ofMinutes(5))
    
    /**
     * Check if the cache is healthy.
     */
    fun isHealthy(): Boolean
    
    /**
     * Clear all cached stats.
     */
    fun clear()

    /**
     * Clear cached stats keys that start with the given prefix.
     *
     * Prefix is matched against the logical cache key (without the Valkey keyPrefix).
     * Example: prefix = "dashboard:team=flex".
     */
    fun clearByPrefix(prefix: String)
}

/**
 * In-memory stats cache implementation.
 * Used as fallback when Valkey is unavailable.
 */
class InMemoryStatsCache : StatsCache {
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
    
    override fun set(key: String, jsonValue: String, ttl: Duration) {
        val expiresAt = System.currentTimeMillis() + ttl.toMillis()
        cache[key] = CacheEntry(expiresAt, jsonValue)
    }
    
    override fun isHealthy(): Boolean = true
    
    override fun clear() {
        cache.clear()
        log.info("In-memory stats cache cleared")
    }

    override fun clearByPrefix(prefix: String) {
        if (prefix.isBlank()) return
        val keysToRemove = cache.keys.filter { it.startsWith(prefix) }
        keysToRemove.forEach { cache.remove(it) }
        log.info("In-memory stats cache cleared by prefix '$prefix' (${keysToRemove.size} keys)")
    }
}

/**
 * No-op stats cache implementation.
 * Use when caching should be disabled (e.g. Valkey unavailable and no fallback desired).
 */
class NoopStatsCache : StatsCache {
    override fun get(key: String): String? = null

    override fun set(key: String, jsonValue: String, ttl: Duration) = Unit

    override fun isHealthy(): Boolean = false

    override fun clear() = Unit

    override fun clearByPrefix(prefix: String) = Unit
}

/**
 * Valkey/Redis stats cache implementation using Jedis.
 * Optionally falls back to another StatsCache if Valkey is unavailable.
 * 
 * Default TTL: 5 minutes for stats data.
 */
class ValkeyStatsCache private constructor(
    private val jedisPool: JedisPool,
    private val keyPrefix: String = "stats:",
    private val fallback: StatsCache? = InMemoryStatsCache()
) : StatsCache {
    
    // Metrics
    private val cacheHitCounter = Counter.builder("stats_cache_hits_total")
        .description("Number of stats cache hits")
        .register(appMicrometerRegistry)
    
    private val cacheMissCounter = Counter.builder("stats_cache_misses_total")
        .description("Number of stats cache misses")
        .register(appMicrometerRegistry)
    
    private val cacheErrorCounter = Counter.builder("stats_cache_errors_total")
        .description("Number of stats cache errors")
        .register(appMicrometerRegistry)
    
    private val cacheOperationTimer = Timer.builder("stats_cache_operation_seconds")
        .description("Duration of stats cache operations")
        .register(appMicrometerRegistry)
    
    override fun get(key: String): String? {
        val fullKey = keyPrefix + key
        
        return try {
            val startTime = System.nanoTime()
            val value = jedisPool.resource.use { jedis ->
                jedis.get(fullKey)
            }
            cacheOperationTimer.record(Duration.ofNanos(System.nanoTime() - startTime))
            
            if (value.isNullOrEmpty()) {
                cacheMissCounter.increment()
                fallback?.get(key)
            } else {
                cacheHitCounter.increment()
                log.debug("Stats cache hit for key: $key")
                value
            }
        } catch (e: JedisConnectionException) {
            cacheErrorCounter.increment()
            log.warn("Failed to get from Valkey stats cache, using fallback", e)
            fallback?.get(key)
        } catch (e: Exception) {
            cacheErrorCounter.increment()
            log.warn("Unexpected error getting from Valkey stats cache", e)
            fallback?.get(key)
        }
    }
    
    override fun set(key: String, jsonValue: String, ttl: Duration) {
        val fullKey = keyPrefix + key
        
        try {
            val startTime = System.nanoTime()
            jedisPool.resource.use { jedis ->
                jedis.setex(fullKey, ttl.seconds, jsonValue)
            }
            cacheOperationTimer.record(Duration.ofNanos(System.nanoTime() - startTime))
            
            log.debug("Cached stats for key: $key (TTL: ${ttl.seconds}s)")
        } catch (e: JedisConnectionException) {
            cacheErrorCounter.increment()
            log.warn("Failed to set in Valkey stats cache, using fallback", e)
            fallback?.set(key, jsonValue, ttl)
        } catch (e: Exception) {
            cacheErrorCounter.increment()
            log.warn("Unexpected error setting in Valkey stats cache", e)
            fallback?.set(key, jsonValue, ttl)
        }
    }
    
    override fun isHealthy(): Boolean {
        return try {
            jedisPool.resource.use { jedis -> jedis.ping() } == "PONG"
        } catch (e: Exception) {
            false
        }
    }
    
    override fun clear() {
        try {
            val keys = jedisPool.resource.use { jedis ->
                jedis.keys("${keyPrefix}*")
            }
            if (keys.isNotEmpty()) {
                jedisPool.resource.use { jedis ->
                    jedis.del(*keys.toTypedArray())
                }
            }
            fallback?.clear()
            log.info("Valkey stats cache cleared (${keys.size} keys)")
        } catch (e: Exception) {
            log.warn("Failed to clear Valkey stats cache", e)
            fallback?.clear()
        }
    }

    override fun clearByPrefix(prefix: String) {
        if (prefix.isBlank()) return

        try {
            val keys = jedisPool.resource.use { jedis ->
                jedis.keys("${keyPrefix}${prefix}*")
            }
            if (keys.isNotEmpty()) {
                jedisPool.resource.use { jedis ->
                    jedis.del(*keys.toTypedArray())
                }
            }
            fallback?.clearByPrefix(prefix)
            log.info("Valkey stats cache cleared by prefix '$prefix' (${keys.size} keys)")
        } catch (e: Exception) {
            log.warn("Failed to clear Valkey stats cache by prefix '$prefix'", e)
            fallback?.clearByPrefix(prefix)
        }
    }
    
    companion object {
        /**
         * Create a ValkeyStatsCache from NAIS environment variables.
         * Returns InMemoryStatsCache if Valkey is not configured.
         */
        fun fromEnvOrFallback(): StatsCache {
            val valkeyEnv = ServerEnv.current.valkey
            val uri = valkeyEnv.uri
            
            if (uri.isNullOrBlank()) {
                log.info("Valkey not configured for stats cache, using in-memory cache")
                return InMemoryStatsCache()
            }

            val username = valkeyEnv.username
            val password = valkeyEnv.password
            
            return try {
                val jedisPool = JedisFactory.createPool(uri = uri, username = username, password = password)
                
                // Test connection
                jedisPool.resource.use { jedis -> jedis.ping() }
                
                log.info("Valkey stats cache connected successfully")
                ValkeyStatsCache(jedisPool)
            } catch (e: Exception) {
                log.error("Failed to connect to Valkey for stats cache, using in-memory fallback", e)
                InMemoryStatsCache()
            }
        }

        /**
         * Create a ValkeyStatsCache from NAIS environment variables.
         * Returns NoopStatsCache if Valkey is not configured or unavailable.
         */
        fun fromEnvOrNoop(): StatsCache {
            val valkeyEnv = ServerEnv.current.valkey
            val uri = valkeyEnv.uri

            if (uri.isNullOrBlank()) {
                log.warn("Valkey not configured for stats cache; caching disabled")
                return NoopStatsCache()
            }

            val username = valkeyEnv.username
            val password = valkeyEnv.password

            return try {
                val jedisPool = JedisFactory.createPool(uri = uri, username = username, password = password)
                jedisPool.resource.use { jedis -> jedis.ping() }
                log.info("Valkey stats cache connected successfully")
                ValkeyStatsCache(jedisPool, fallback = null)
            } catch (e: Exception) {
                log.error("Failed to connect to Valkey for stats cache; caching disabled", e)
                NoopStatsCache()
            }
        }
        
        /**
         * Create for testing with custom Jedis.
         */
        fun forTesting(jedisPool: JedisPool, keyPrefix: String = "test:stats:"): ValkeyStatsCache {
            return ValkeyStatsCache(jedisPool, keyPrefix = keyPrefix)
        }
    }
}
