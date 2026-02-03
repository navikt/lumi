package no.nav.lumi.routes

import io.ktor.http.*
import io.ktor.server.plugins.openapi.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.util.*

/**
 * Uses `hide()` to exclude internal endpoints from OpenAPI/Swagger output.
 */
@OptIn(ExperimentalKtorApi::class)
fun Route.internalRoutes() {
    route("/internal") {
        get("/isAlive") {
            call.respondText("OK", ContentType.Text.Plain)
        }
        
        get("/isReady") {
            call.respondText("OK", ContentType.Text.Plain)
        }
        
        get("/prometheus") {
            call.respondText(no.nav.lumi.config.appMicrometerRegistry.scrape(), ContentType.parse(io.micrometer.prometheusmetrics.PrometheusConfig.DEFAULT.get("contentType") ?: "text/plain; version=0.0.4; charset=utf-8"))
        }
    }.hide()
}
