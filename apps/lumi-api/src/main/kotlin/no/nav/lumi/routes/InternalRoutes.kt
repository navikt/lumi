package no.nav.lumi.routes

import io.ktor.http.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import no.nav.lumi.config.DatabaseHolder
import no.nav.lumi.config.isDatabaseReady

fun Route.internalRoutes() {
    route("/internal") {
        get("/isAlive") {
            call.respondText("OK", ContentType.Text.Plain)
        }

        get("/isReady") {
            if (isDatabaseReady(DatabaseHolder.dataSource)) {
                call.respondText("OK", ContentType.Text.Plain)
            } else {
                call.respondText(
                    "Database not ready",
                    ContentType.Text.Plain,
                    HttpStatusCode.ServiceUnavailable
                )
            }
        }
        
        get("/prometheus") {
            call.respondText(no.nav.lumi.config.appMicrometerRegistry.scrape(), ContentType.parse(io.micrometer.prometheusmetrics.PrometheusConfig.DEFAULT.get("contentType") ?: "text/plain; version=0.0.4; charset=utf-8"))
        }
    }
}
