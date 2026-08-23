package no.nav.lumi.config

import ch.qos.logback.classic.Level
import ch.qos.logback.classic.Logger
import ch.qos.logback.classic.spi.ILoggingEvent
import ch.qos.logback.core.read.ListAppender
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.ktor.client.request.bearerAuth
import io.ktor.client.request.get
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.install
import io.ktor.server.auth.Authentication
import io.ktor.server.auth.authenticate
import io.ktor.server.auth.bearer
import io.ktor.server.response.respondText
import io.ktor.server.routing.get
import io.ktor.server.routing.routing
import io.ktor.server.testing.testApplication
import no.nav.lumi.config.auth.BrukerPrincipal
import no.nav.lumi.config.auth.pseudonymizeIdentifier
import org.slf4j.LoggerFactory

class CallLoggingPrivacyTest : FunSpec({
    test("access log pseudonymizes NAVident in MDC") {
        val accessEvent = captureAccessEvent(navIdent = "Z123456")
        accessEvent.mdcPropertyMap["navIdent"] shouldBe pseudonymizeIdentifier("Z123456")
        accessEvent.mdcPropertyMap["navIdent"] shouldNotBe "Z123456"
    }

    test("access log omits NAVident from MDC when principal has no identifier") {
        val accessEvent = captureAccessEvent(navIdent = null)

        accessEvent.mdcPropertyMap.containsKey("navIdent") shouldBe false
    }
})

private fun captureAccessEvent(navIdent: String?): ILoggingEvent {
    val accessLogger = LoggerFactory.getLogger("CallLoggingPrivacyTest") as Logger
    val originalLevel = accessLogger.level
    val logAppender = ListAppender<ILoggingEvent>().apply { start() }
    accessLogger.level = Level.INFO
    accessLogger.addAppender(logAppender)

    try {
        testApplication {
            environment {
                log = accessLogger
            }
            application {
                configureCallLogging()
                install(Authentication) {
                    bearer("test") {
                        authenticate {
                            BrukerPrincipal(
                                navIdent = navIdent,
                                name = "Test User",
                                email = "test.user@nav.no",
                                clientId = "dev-gcp:team-esyfo:lumi-dashboard",
                            )
                        }
                    }
                }
                routing {
                    authenticate("test") {
                        get("/analytics") {
                            call.respondText("OK")
                        }
                    }
                }
            }

            client.get("/analytics") {
                bearerAuth("valid-token")
            }.status shouldBe HttpStatusCode.OK
        }
    } finally {
        accessLogger.detachAppender(logAppender)
        accessLogger.level = originalLevel
        logAppender.stop()
    }

    return logAppender.list.single { event ->
        event.formattedMessage.contains("/analytics")
    }
}
