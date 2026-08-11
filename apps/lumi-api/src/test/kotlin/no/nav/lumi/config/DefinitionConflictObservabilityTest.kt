package no.nav.lumi.config

import ch.qos.logback.classic.Level
import ch.qos.logback.classic.Logger
import ch.qos.logback.classic.spi.ILoggingEvent
import ch.qos.logback.core.read.ListAppender
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.doubles.shouldBeExactly
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.ktor.client.request.get
import io.ktor.http.HttpStatusCode
import io.ktor.server.response.respondText
import io.ktor.server.routing.get
import io.ktor.server.routing.routing
import io.ktor.server.testing.testApplication
import io.micrometer.prometheusmetrics.PrometheusConfig
import io.micrometer.prometheusmetrics.PrometheusMeterRegistry
import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.config.auth.CallerIdentity
import no.nav.lumi.config.auth.CallerIdentityKey
import org.slf4j.LoggerFactory

class DefinitionConflictObservabilityTest : FunSpec({
    test("only structural definition conflicts increment the conflict counter") {
        val meterRegistry = PrometheusMeterRegistry(PrometheusConfig.DEFAULT)
        val definitionConflictLogger = LoggerFactory.getLogger("SurveyDefinitionConflict") as Logger
        val logAppender = ListAppender<ILoggingEvent>().apply { start() }
        definitionConflictLogger.addAppender(logAppender)

        try {
            testApplication {
                application {
                    configureSerialization()
                    configureStatusPages(DefinitionConflictObservability(meterRegistry))
                    routing {
                        get("/definition-conflict") {
                            call.attributes.put(
                                CallerIdentityKey,
                                CallerIdentity("team-a", "app-a", null, null)
                            )
                            throw ApiErrorException.DefinitionConflictException(
                                team = "team-a",
                                surveyId = "survey-1",
                                errorMessage = "Survey definition conflict"
                            )
                        }
                        get("/other-conflict") {
                            throw ApiErrorException.ConflictException("Another conflict")
                        }
                        get("/ok") {
                            call.respondText("OK")
                        }
                    }
                }

                client.get("/definition-conflict").status shouldBe HttpStatusCode.Conflict
                client.get("/other-conflict").status shouldBe HttpStatusCode.Conflict
                client.get("/ok").status shouldBe HttpStatusCode.OK
            }
        } finally {
            definitionConflictLogger.detachAppender(logAppender)
            logAppender.stop()
        }

        meterRegistry.get("lumi_survey_definition_conflicts_total")
            .counter()
            .count()
            .shouldBeExactly(1.0)
        meterRegistry.scrape() shouldContain "lumi_survey_definition_conflicts_total 1.0"

        val conflictLog = logAppender.list.first { event ->
            event.keyValuePairs.any { it.key == "survey_id" && it.value == "survey-1" }
        }
        conflictLog.level shouldBe Level.WARN
        conflictLog.keyValuePairs.associate { it.key to it.value } shouldBe mapOf(
            "event_type" to "survey_definition_conflict",
            "caller_team" to "team-a",
            "survey_id" to "survey-1",
            "path" to "/definition-conflict",
            "conflict_details" to "Survey definition conflict",
            "caller_app" to "app-a"
        )
    }
})
