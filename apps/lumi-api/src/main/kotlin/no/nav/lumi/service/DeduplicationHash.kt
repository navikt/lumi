package no.nav.lumi.service

import java.nio.ByteBuffer
import java.security.MessageDigest

internal fun computeDeduplicationKeyHash(team: String, surveyId: String, deduplicationKey: String): String {
    val digest = MessageDigest.getInstance("SHA-256")
    digest.updateLengthPrefixed("lumi-feedback-dedup-v1")
    digest.updateLengthPrefixed(team)
    digest.updateLengthPrefixed(surveyId)
    digest.updateLengthPrefixed(deduplicationKey)
    return digest.digest().joinToString("") { byte -> "%02x".format(byte.toInt() and 0xff) }
}

private fun MessageDigest.updateLengthPrefixed(value: String) {
    val bytes = value.toByteArray(Charsets.UTF_8)
    update(ByteBuffer.allocate(Int.SIZE_BYTES).putInt(bytes.size).array())
    update(bytes)
}
