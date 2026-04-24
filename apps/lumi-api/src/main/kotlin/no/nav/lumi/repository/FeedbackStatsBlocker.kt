package no.nav.lumi.repository

import no.nav.lumi.domain.BlockerThemeResult
import no.nav.lumi.service.text.StemWordAccumulator

internal class ThemeAccumulator(
    val theme: String,
    val themeId: String,
    val color: String?,
    val examples: MutableList<String> = mutableListOf(),
    val usedExamples: MutableSet<String> = mutableSetOf(),
    var count: Int = 0,
) {
    fun toResult(): BlockerThemeResult {
        return BlockerThemeResult(
            theme = theme,
            themeId = themeId,
            count = count,
            examples = examples.toList(),
            color = color,
        )
    }
}
