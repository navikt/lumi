package no.nav.lumi

import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import no.nav.lumi.config.configureAuth
import no.nav.lumi.config.configureDatabase
import no.nav.lumi.config.configureSecurityHeaders
import no.nav.lumi.config.configureMetrics
import no.nav.lumi.config.configureRateLimiting
import no.nav.lumi.config.configureRetentionCleanup
import no.nav.lumi.config.configureRouting
import no.nav.lumi.config.configureSerialization
import no.nav.lumi.config.configureStatusPages
import no.nav.lumi.config.configureCallLogging

fun main() {
    embeddedServer(
        Netty,
        port = 8080,
        host = "0.0.0.0",
        module = Application::module
    ).start(wait = true)
}

fun Application.module() {
    configureSerialization()
    configureStatusPages()
    configureSecurityHeaders()
    configureCallLogging()
    configureRateLimiting()
    configureAuth()
    configureDatabase()
    configureMetrics()
    configureRetentionCleanup()
    configureRouting()
}
