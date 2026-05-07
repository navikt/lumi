package no.nav.lumi.sensitive

internal fun generateUniqueKey(
    written: Map<String, *>,
    originalKeys: Set<String>,
    startCounter: Int
): String {
    var candidate = "[REDACTED_KEY_$startCounter]"
    var suffix = startCounter
    while (written.containsKey(candidate) || originalKeys.contains(candidate)) {
        suffix++
        candidate = "[REDACTED_KEY_$suffix]"
    }
    return candidate
}
