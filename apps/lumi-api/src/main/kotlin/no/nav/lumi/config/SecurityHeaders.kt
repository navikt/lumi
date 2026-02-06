package no.nav.lumi.config

import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationCallPipeline
import io.ktor.server.application.call

fun Application.configureSecurityHeaders() {
    intercept(ApplicationCallPipeline.Plugins) {
        call.response.headers.append("X-Content-Type-Options", "nosniff")
        call.response.headers.append("X-Frame-Options", "DENY")
        call.response.headers.append("Referrer-Policy", "no-referrer")
        call.response.headers.append("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
    }
}
