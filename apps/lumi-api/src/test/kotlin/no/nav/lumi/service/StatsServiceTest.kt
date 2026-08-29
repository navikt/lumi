package no.nav.lumi.service

import no.nav.lumi.domain.StatsQuery
import no.nav.lumi.domain.FieldTrendGranularity
import no.nav.lumi.integrations.valkey.InMemoryStatsCache
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Assertions.*

class StatsServiceTest {
    
    private val service = StatsService()

    @Test
    fun `stats cache key includes the result contract version`() {
        assertEquals(
            "dashboard:team=flex&includeArchived=false&resultVersion=3",
            service.statsCacheKey("dashboard", StatsQuery(team = "flex")),
        )
    }

    @Test
    fun `field trend cache keys separate default selection from a field named auto`() {
        val query = StatsQuery(team = "flex", surveyId = "survey-1")

        assertNotEquals(
            service.fieldTrendCacheKey(query, null, FieldTrendGranularity.WEEK),
            service.fieldTrendCacheKey(query, "auto", FieldTrendGranularity.WEEK),
        )
    }

    @Test
    fun `team invalidation clears field trend cache without clearing another team`() {
        val cache = InMemoryStatsCache()
        val flexKey = service.fieldTrendCacheKey(
            StatsQuery(team = "flex", surveyId = "survey-1"),
            "field-1",
            FieldTrendGranularity.WEEK,
        )
        val otherKey = service.fieldTrendCacheKey(
            StatsQuery(team = "other", surveyId = "survey-1"),
            "field-1",
            FieldTrendGranularity.WEEK,
        )
        cache.set(flexKey, "flex-value")
        cache.set(otherKey, "other-value")

        StatsCacheInvalidator(cache).invalidateTeam("flex")

        assertNull(cache.get(flexKey))
        assertEquals("other-value", cache.get(otherKey))
    }

    @Test
    fun `calculateAverageRating returns correct average`() {
        val byRating = mapOf("5" to 3, "4" to 5, "3" to 2)
        
        val average = service.calculateAverageRating(byRating)
        
        // (5*3 + 4*5 + 3*2) / 10 = (15 + 20 + 6) / 10 = 4.1
        assertEquals(4.1, average!!, 0.01)
    }
    
    @Test
    fun `calculateAverageRating returns null for empty map`() {
        val byRating = emptyMap<String, Int>()
        
        val average = service.calculateAverageRating(byRating)
        
        assertNull(average)
    }
    
    @Test
    fun `calculateAverageRating ignores non-numeric ratings`() {
        val byRating = mapOf("5" to 2, "good" to 5, "3" to 3)
        
        val average = service.calculateAverageRating(byRating)
        
        // Only count 5*2 and 3*3 = (10 + 9) / 5 = 3.8
        assertEquals(3.8, average!!, 0.01)
    }
    
    @Test
    fun `calculateDays returns correct number of days`() {
        val from = "2024-01-01"
        val to = "2024-01-15"
        
        val days = service.calculateDays(from, to)
        
        assertEquals(15, days)
    }
    
    @Test
    fun `calculateDays returns at least 1 for same day`() {
        val from = "2024-01-01"
        val to = "2024-01-01"
        
        val days = service.calculateDays(from, to)
        
        assertEquals(1, days)
    }
    
    @Test
    fun `calculateDays returns 30 for null values`() {
        val days = service.calculateDays(null, null)
        
        assertEquals(30, days)
    }
    
    @Test
    fun `calculateDays returns 30 for invalid dates`() {
        val from = "not-a-date"
        val to = "also-not-a-date"
        
        val days = service.calculateDays(from, to)
        
        assertEquals(30, days)
    }
}
