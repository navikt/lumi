package no.nav.lumi.config

import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import io.ktor.server.application.install
import io.ktor.server.plugins.cors.routing.CORS
import io.ktor.server.routing.Route
import org.slf4j.LoggerFactory
import java.net.URI

private val log = LoggerFactory.getLogger("Cors")

/**
 * Installs CORS on this route scope.
 *
 * Only browser-facing routes (analytics/dashboard) should have CORS.
 * Server-to-server submission routes must NOT be covered, because calling
 * apps may forward the browser Origin header, which would trigger a 403
 * from the CORS plugin if the origin is not in the allow-list.
 */
fun Route.installCors() {
    val env = ServerEnv.current
    val configuredOrigins = System.getenv("LUMI_CORS_ALLOWED_ORIGINS")
        ?.split(",")
        ?.map { it.trim() }
        ?.filter { it.isNotBlank() }
        ?: emptyList()

    val allowedOrigins = if (configuredOrigins.isNotEmpty()) {
        configuredOrigins
    } else if (env.nais.isLocal) {
        listOf("http://localhost:3000", "http://127.0.0.1:3000")
    } else {
        emptyList()
    }

    if (allowedOrigins.isEmpty()) {
        log.info("CORS not enabled (no allowed origins configured)")
        return
    }

    install(CORS) {
        // Lumi API uses bearer tokens, not cookie-based cross-origin auth.
        // Keep credentials disabled to reduce CSRF/misconfiguration blast radius.
        allowCredentials = false
        allowNonSimpleContentTypes = true
        allowHeader(HttpHeaders.Authorization)
        allowHeader(HttpHeaders.ContentType)
        allowMethod(HttpMethod.Get)
        allowMethod(HttpMethod.Post)
        allowMethod(HttpMethod.Delete)
        allowMethod(HttpMethod.Put)
        allowMethod(HttpMethod.Options)

        allowedOrigins.forEach { origin ->
            val uri = runCatching { URI(origin) }.getOrNull()
            val host = uri?.host
            val scheme = uri?.scheme
            if (host.isNullOrBlank() || scheme.isNullOrBlank()) {
                log.warn("Skipping invalid CORS origin: $origin")
            } else {
                allowHost(host, schemes = listOf(scheme))
            }
        }
    }
}
