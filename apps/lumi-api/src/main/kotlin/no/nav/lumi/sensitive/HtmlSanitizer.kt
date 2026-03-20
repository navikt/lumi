package no.nav.lumi.sensitive

/**
 * Defense-in-depth HTML sanitizer for context fields (url, pathname, userAgent, tags).
 *
 * Uses simple regex-based tag stripping. This is intentionally scoped to structured
 * context fields where HTML is never legitimate content. User-authored text answers
 * are NOT sanitized here — React handles contextual escaping at render time.
 *
 * Known limitations:
 * - Unclosed tags (e.g. `<script`) are not matched
 * - HTML entities (e.g. `&lt;script&gt;`) pass through unchanged
 * - Legitimate angle brackets in non-HTML contexts may be affected
 *
 * These are acceptable tradeoffs given the narrow scope: context fields are also
 * validated by SubmissionValidator (URL scheme, pathname format, length limits),
 * so malformed HTML is unlikely to reach this sanitizer in a meaningful form.
 *
 * If sanitization needs expand to user-authored content in the future,
 * consider upgrading to a parser-based solution (e.g. jsoup).
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
