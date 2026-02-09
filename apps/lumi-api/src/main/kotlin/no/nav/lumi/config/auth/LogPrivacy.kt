package no.nav.lumi.config.auth

import java.security.MessageDigest

private const val HASH_LENGTH = 12

private fun sha256Hex(value: String): String =
    MessageDigest.getInstance("SHA-256")
        .digest(value.toByteArray())
        .joinToString("") { "%02x".format(it) }

/**
 * Stable pseudonym for identifiers used in open logs.
 */
fun pseudonymizeIdentifier(value: String?): String {
    if (value.isNullOrBlank()) {
        return "none"
    }
    return "id:${sha256Hex(value).take(HASH_LENGTH)}"
}

/**
 * Minimizes logging detail for caller client IDs in format cluster:namespace:app.
 */
fun summarizeClientId(clientId: String?): String {
    val identity = clientId?.let { parseCallerIdentity(it) } ?: return "unknown-client"
    return "team=${identity.team},app=${identity.app}"
}
