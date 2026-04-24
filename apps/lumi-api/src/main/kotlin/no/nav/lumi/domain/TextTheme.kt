package no.nav.lumi.domain

import kotlinx.serialization.Serializable

@Serializable
enum class AnalysisContext {
    GENERAL_FEEDBACK,
    BLOCKER
}

/**
 * Text theme definition - used to group free-text responses by keyword matching.
 * Themes are team-scoped and can be reused across ALL survey types.
 */
@Serializable
data class TextThemeDto(
    val id: String,
    val team: String,
    val name: String,
    val keywords: List<String>,
    val color: String? = null,
    val priority: Int = 0,
    val analysisContext: AnalysisContext
)

/**
 * Request body for creating a new theme
 */
@Serializable
data class CreateThemeRequest(
    val name: String,
    val keywords: List<String>,
    val color: String? = null,
    val priority: Int? = null,
    val analysisContext: AnalysisContext
)

/**
 * Request body for updating an existing theme
 */
@Serializable
data class UpdateThemeRequest(
    val name: String? = null,
    val keywords: List<String>? = null,
    val color: String? = null,
    val priority: Int? = null,
    val analysisContext: AnalysisContext
)

// ============================================
// Discovery Statistics Response Types
// (Still named Discovery since the endpoint is for Discovery dashboard)
// ============================================

/**
 * A matched theme with aggregated statistics
 */
@Serializable
data class ThemeResult(
    val theme: String,
    val count: Int,
    val successRate: Double,
    val examples: List<String>
)

/**
 * Source response for context examples in word cloud
 */
@Serializable
data class SourceResponse(
    val text: String,
    val submittedAt: String
)

/**
 * Word variant with its count (for showing normalization info)
 */
@Serializable
data class WordVariant(
    val word: String,
    val count: Int
)

/**
 * Word frequency entry for word cloud (unified for Discovery and Blocker).
 * Groups word variants by stem and provides context examples.
 *
 * @property word Canonical display form (most common surface form)
 * @property stem Normalized/stemmed form (stable key for grouping)
 * @property count Total occurrences across all variants
 * @property variants Top word variants with their counts (max 5)
 * @property sourceResponses Example responses containing this word (max 3 for discovery, 5 for blocker)
 */
@Serializable
data class WordFrequencyEntry(
    val word: String,
    val stem: String,
    val count: Int,
    val variants: List<WordVariant> = emptyList(),
    val sourceResponses: List<SourceResponse> = emptyList()
)

/**
 * Recent discovery response
 */
@Serializable
data class DiscoveryRecentResponse(
    val task: String,
    val success: String,  // "yes" | "partial" | "no"
    val blocker: String? = null,
    val submittedAt: String
)

/**
 * A frequently occurring two-word phrase (bigram) extracted from free-text responses.
 */
@Serializable
data class PhraseEntry(
    val text: String,
    val count: Int,
    val sourceResponseIds: List<String> = emptyList()
)

/**
 * A representative quote from a free-text response.
 */
@Serializable
data class QuoteEntry(
    val text: String,
    val answeredAt: String,
)

/**
 * Full discovery statistics response
 */
@Serializable
data class DiscoveryStatsResponse(
    val totalSubmissions: Int,
    val wordFrequency: List<WordFrequencyEntry>,
    val themes: List<ThemeResult>,
    val recentResponses: List<DiscoveryRecentResponse>,
    val phrases: List<PhraseEntry> = emptyList(),
    val quotes: List<QuoteEntry> = emptyList(),
    val confidenceLevel: String = "low",
)

// ============================================
// Blocker Statistics Response Types
// ============================================

@Serializable
data class BlockerThemeResult(
    val theme: String,
    val themeId: String,
    val count: Int,
    val examples: List<String>,
    val color: String? = null
)

@Serializable
data class RecentBlockerResponse(
    val blocker: String,
    val task: String,
    val submittedAt: String
)

@Serializable
data class BlockerStatsResponse(
    val totalBlockers: Int,
    val wordFrequency: List<WordFrequencyEntry>,  // Uses unified WordFrequencyEntry
    val themes: List<BlockerThemeResult>,
    val recentBlockers: List<RecentBlockerResponse>,
    val phrases: List<PhraseEntry> = emptyList(),
    val quotes: List<QuoteEntry> = emptyList(),
    val confidenceLevel: String = "low",
)
