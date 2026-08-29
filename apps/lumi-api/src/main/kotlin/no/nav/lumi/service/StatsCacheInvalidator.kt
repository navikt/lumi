package no.nav.lumi.service

import no.nav.lumi.integrations.valkey.StatsCache
import no.nav.lumi.integrations.valkey.ValkeyStatsCache
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

/**
 * Central place for invalidating stats caches after writes.
 *
 * Stats endpoints are cached (typically 2–10 minutes). After a mutation like deleting feedback,
 * we want dashboard numbers to reflect reality immediately.
 */
class StatsCacheInvalidator(
    private val statsCache: StatsCache = ValkeyStatsCache.fromEnvOrFallback(),
) {
    fun invalidateTeam(team: String) {
        val encodedTeam = URLEncoder.encode(team, StandardCharsets.UTF_8)
        val teamPrefix = "team=$encodedTeam"

        // StatsService cache keys always start with "<prefix>:team=...".
        val prefixes = listOf(
            "dashboard:$teamPrefix",
            "overview:$teamPrefix",
            "ratings:$teamPrefix",
            "timeline:$teamPrefix",
            "topTasks:$teamPrefix",
            "surveyTypes:$teamPrefix",
            "blockers:$teamPrefix",
            "taskPriority:$teamPrefix",
            "field-trend-v2:$teamPrefix",
        )

        prefixes.forEach { statsCache.clearByPrefix(it) }
    }
}
