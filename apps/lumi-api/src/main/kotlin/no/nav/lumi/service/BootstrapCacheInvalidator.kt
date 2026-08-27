package no.nav.lumi.service

import no.nav.lumi.integrations.valkey.StringCache
import no.nav.lumi.integrations.valkey.ValkeyStringCache

internal val sharedBootstrapCache: StringCache by lazy {
    ValkeyStringCache.fromEnvOrFallback(keyPrefix = "filters:bootstrap:")
}

internal fun bootstrapCacheTeamPrefix(team: String) = "team=${team.lowercase()}&"

internal fun bootstrapCacheGenerationKey(team: String) = "generation:team=${team.lowercase()}"

class BootstrapCacheInvalidator(
    private val cache: StringCache = sharedBootstrapCache,
) {
    fun invalidateTeam(team: String) {
        cache.increment(bootstrapCacheGenerationKey(team))
        cache.clearByPrefix(bootstrapCacheTeamPrefix(team))
    }
}
