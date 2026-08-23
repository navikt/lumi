package no.nav.lumi.config.auth

import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.util.AttributeKey
import no.nav.lumi.config.exception.ApiErrorException
import org.slf4j.LoggerFactory
import java.security.MessageDigest

internal const val INTERNAL_SUBMISSION_KEY_HEADER = "X-Lumi-Submission-Key"

internal val InternalSubmissionAuthenticatedKey =
    AttributeKey<Unit>("InternalSubmissionAuthenticated")

internal class InternalSubmissionAuthPluginConfig {
    lateinit var expectedKey: String
}

private val log = LoggerFactory.getLogger("InternalSubmissionAuthPlugin")

internal val InternalSubmissionAuthPlugin = createRouteScopedPlugin(
    name = "InternalSubmissionAuthPlugin",
    createConfiguration = ::InternalSubmissionAuthPluginConfig,
) {
    val expectedKey = pluginConfig.expectedKey.toByteArray()

    onCall { call ->
        val providedKey = call.request.header(INTERNAL_SUBMISSION_KEY_HEADER)
        if (providedKey == null || !MessageDigest.isEqual(providedKey.toByteArray(), expectedKey)) {
            log.warn("Internal submission: invalid or missing $INTERNAL_SUBMISSION_KEY_HEADER")
            throw ApiErrorException.UnauthorizedException("Invalid submission key")
        }

        call.attributes.put(InternalSubmissionAuthenticatedKey, Unit)
    }
}
