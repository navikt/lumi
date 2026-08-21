package no.nav.lumi.domain

import kotlinx.serialization.SerialName
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
 * A frequently occurring pair of content words extracted from free-text responses.
 * Display text may retain short words and stopwords between the pair.
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
 * Confidence level for text analysis based on response volume.
 * Determines how much weight to give recurring phrases vs. individual quotes.
 */
@Serializable
enum class ConfidenceLevel {
    @SerialName("low") LOW,
    @SerialName("medium") MEDIUM,
    @SerialName("high") HIGH,
}

/**
 * Full discovery statistics response
 */
@Serializable
data class DiscoveryStatsResponse(
    val totalSubmissions: Int,
    val themes: List<ThemeResult>,
    val recentResponses: List<DiscoveryRecentResponse>,
    val phrases: List<PhraseEntry> = emptyList(),
    val quotes: List<QuoteEntry> = emptyList(),
    val confidenceLevel: ConfidenceLevel = ConfidenceLevel.LOW,
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
    val themes: List<BlockerThemeResult>,
    val recentBlockers: List<RecentBlockerResponse>,
    val phrases: List<PhraseEntry> = emptyList(),
    val quotes: List<QuoteEntry> = emptyList(),
    val confidenceLevel: ConfidenceLevel = ConfidenceLevel.LOW,
)
