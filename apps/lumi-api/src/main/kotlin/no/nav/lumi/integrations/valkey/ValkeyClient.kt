package no.nav.lumi.integrations.valkey

import io.micrometer.core.instrument.Counter
import io.micrometer.core.instrument.Timer
import no.nav.lumi.config.ServerEnv
import no.nav.lumi.config.appMicrometerRegistry
import org.slf4j.LoggerFactory
import redis.clients.jedis.RedisClient
import redis.clients.jedis.exceptions.JedisConnectionException
import java.time.Duration
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean

private val log = LoggerFactory.getLogger("ValkeyClient")

/**
 * Cache interface for team lookups.
 * Abstracts the caching layer to allow Valkey or in-memory fallback.
 */
interface TeamCache {
    /**
     * Get cached teams for a user email.
     * Returns null if not cached.
     */
    fun get(email: String): Set<String>?
    
    /**
     * Cache teams for a user with the given TTL.
     */
    fun set(email: String, teams: Set<String>, ttl: Duration)
    
    /**
     * Check if the cache is healthy.
     */
    fun isHealthy(): Boolean
    
    /**
     * Clear all cached entries.
     */
    fun clear()
}

/**
 * In-memory cache implementation using ConcurrentHashMap.
 * Used as fallback when Valkey is unavailable.
 */
class InMemoryTeamCache : TeamCache {
    private data class CacheEntry(val expiresAt: Long, val teams: Set<String>)
    
    private val cache = ConcurrentHashMap<String, CacheEntry>()
    
    override fun get(email: String): Set<String>? {
        val entry = cache[email] ?: return null
        if (System.currentTimeMillis() > entry.expiresAt) {
            cache.remove(email)
            return null
        }
        return entry.teams
    }
    
    override fun set(email: String, teams: Set<String>, ttl: Duration) {
        val expiresAt = System.currentTimeMillis() + ttl.toMillis()
        cache[email] = CacheEntry(expiresAt, teams)
    }
    
    override fun isHealthy(): Boolean = true
    
    override fun clear() {
        cache.clear()
        log.info("In-memory cache cleared")
    }
}

/**
 * Valkey/Redis cache implementation using Jedis.
 * Falls back to in-memory cache if Valkey is unavailable.
 */
class ValkeyTeamCache private constructor(
    private val redisClient: RedisClient,
    private val keyPrefix: String = "teams:",
    private val fallback: InMemoryTeamCache = InMemoryTeamCache()
) : TeamCache {
    
    private val healthy = AtomicBoolean(true)

    
    // Metrics
    private val cacheHitCounter = Counter.builder("valkey_cache_hits_total")
        .description("Number of Valkey cache hits")
        .register(appMicrometerRegistry)
    
    private val cacheMissCounter = Counter.builder("valkey_cache_misses_total")
        .description("Number of Valkey cache misses")
        .register(appMicrometerRegistry)
    
    private val cacheErrorCounter = Counter.builder("valkey_cache_errors_total")
        .description("Number of Valkey cache errors")
        .register(appMicrometerRegistry)
    
    private val cacheOperationTimer = Timer.builder("valkey_cache_operation_seconds")
        .description("Duration of Valkey cache operations")
        .register(appMicrometerRegistry)
    
    override fun get(email: String): Set<String>? {
        val key = keyPrefix + email
        
        return try {
            val startTime = System.nanoTime()
            val members = redisClient.smembers(key)
            cacheOperationTimer.record(Duration.ofNanos(System.nanoTime() - startTime))
            
            if (members.isNullOrEmpty()) {
                cacheMissCounter.increment()
                // Try fallback
                fallback.get(email)
            } else {
                cacheHitCounter.increment()
                healthy.set(true)
                members
            }
        } catch (e: JedisConnectionException) {
            cacheErrorCounter.increment()
            healthy.set(false)
            log.warn("Failed to get from Valkey, using fallback", e)
            fallback.get(email)
        } catch (e: Exception) {
            cacheErrorCounter.increment()
            log.warn("Unexpected error getting from Valkey", e)
            fallback.get(email)
        }
    }
    
    override fun set(email: String, teams: Set<String>, ttl: Duration) {
        val key = keyPrefix + email
        
        try {
            val startTime = System.nanoTime()
            
            // Use pipeline for atomicity
            redisClient.del(key)
            if (teams.isNotEmpty()) {
                redisClient.sadd(key, *teams.toTypedArray())
                redisClient.expire(key, ttl.seconds)
            } else {
                // For empty teams, store a sentinel value to distinguish from "not cached"
                redisClient.sadd(key, "__EMPTY__")
                redisClient.expire(key, ttl.seconds)
            }
            
            cacheOperationTimer.record(Duration.ofNanos(System.nanoTime() - startTime))
            healthy.set(true)
            
            log.debug("Cached teams for $email with TTL ${ttl.seconds}s: $teams")
        } catch (e: JedisConnectionException) {
            cacheErrorCounter.increment()
            healthy.set(false)
            log.warn("Failed to set in Valkey, using fallback", e)
            fallback.set(email, teams, ttl)
        } catch (e: Exception) {
            cacheErrorCounter.increment()
            log.warn("Unexpected error setting in Valkey", e)
            fallback.set(email, teams, ttl)
        }
    }
    
    override fun isHealthy(): Boolean = healthy.get()
    
    override fun clear() {
        try {
            // Note: In production, be careful with KEYS command on large datasets
            val keys = redisClient.keys("${keyPrefix}*")
            if (keys.isNotEmpty()) {
                redisClient.del(*keys.toTypedArray())
            }
            fallback.clear()
            log.info("Valkey cache cleared (${keys.size} keys)")
        } catch (e: Exception) {
            log.warn("Failed to clear Valkey cache", e)
            fallback.clear()
        }
    }
    
    companion object {
        /**
         * Create a ValkeyTeamCache from NAIS environment variables.
         * Returns InMemoryTeamCache if Valkey is not configured.
         */
        fun fromEnvOrFallback(): TeamCache {
            val valkeyEnv = ServerEnv.current.valkey
            val uri = valkeyEnv.uri
            
            if (uri.isNullOrBlank()) {
                log.info("Valkey not configured, using in-memory cache")
                return InMemoryTeamCache()
            }

            val username = valkeyEnv.username
            val password = valkeyEnv.password
            
            return try {
                val redisClient = JedisFactory.createClient(uri = uri, username = username, password = password)
                
                // Test connection
                redisClient.ping()
                
                log.info("Valkey cache connected successfully")
                ValkeyTeamCache(redisClient)
            } catch (e: Exception) {
                log.error("Failed to connect to Valkey, using in-memory fallback", e)
                InMemoryTeamCache()
            }
        }
        
        /**
         * Create a ValkeyTeamCache for testing.
         */
        fun forTesting(redisClient: RedisClient, keyPrefix: String = "test:teams:"): ValkeyTeamCache {
            return ValkeyTeamCache(redisClient, keyPrefix = keyPrefix)
        }
    }
}
