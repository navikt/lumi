package no.nav.lumi.sensitive

/**
 * Defense-in-depth HTML sanitizer.
 *
 * Frontend rendering is escaped by default, but we still strip HTML tags before storage
 * to reduce accidental propagation of markup through exports/integrations.
 */
class HtmlSanitizer {
    fun stripTags(value: String?): String {
        if (value.isNullOrEmpty()) return value ?: ""
        return HTML_TAG_REGEX.replace(value, "").trim()
    }

    companion object {
        val DEFAULT = HtmlSanitizer()
        private val HTML_TAG_REGEX = Regex("<[^>]*>")
    }
}
