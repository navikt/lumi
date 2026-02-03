package no.nav.lumi.config

import io.ktor.server.application.*
import io.ktor.server.plugins.openapi.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.util.*
import org.slf4j.LoggerFactory

private val log = LoggerFactory.getLogger("OpenApi")

/**
 * Uses experimental OpenAPI helpers (`descendants()`/`hide()`) to assemble docs
 * and hide internal endpoints from the published spec.
 */
@OptIn(ExperimentalKtorApi::class)
fun Application.configureOpenApi() {
    routing {
        val routingRoot = this
        get("openapi.json") {
            val doc = OpenApiDoc(info = OpenApiInfo(title = "Lumi API", version = "1.0.0")) +
                routingRoot.descendants()
            call.respond(doc)
        }.hide()
        openAPI(path = "openapi") {
            info = OpenApiInfo(title = "Lumi API", version = "1.0.0")
            source = OpenApiDocSource.Routing {
                routingRoot.descendants()
            }
        }
        swaggerUI(path = "swagger") {
            info = OpenApiInfo(title = "Lumi API", version = "1.0.0")
            source = OpenApiDocSource.Routing(ContentType.Application.Json) {
                routingRoot.descendants()
            }
        }
    }
}
