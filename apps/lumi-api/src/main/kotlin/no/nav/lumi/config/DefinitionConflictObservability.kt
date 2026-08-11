package no.nav.lumi.config

import io.micrometer.core.instrument.Counter
import io.micrometer.core.instrument.MeterRegistry
import no.nav.lumi.config.exception.ApiErrorException
import org.slf4j.LoggerFactory

class DefinitionConflictObservability(
    meterRegistry: MeterRegistry = appMicrometerRegistry
) {
    private val conflictCounter = Counter.builder(METRIC_NAME)
        .description("Number of submissions rejected because a survey definition changed structurally")
        .register(meterRegistry)

    fun record(
        conflict: ApiErrorException.DefinitionConflictException,
        path: String,
        app: String?
    ) {
        conflictCounter.increment()
        val logEvent = definitionConflictLog.atWarn()
            .addKeyValue("event_type", "survey_definition_conflict")
            .addKeyValue("caller_team", conflict.team)
            .addKeyValue("survey_id", conflict.surveyId)
            .addKeyValue("path", path)
            .addKeyValue("conflict_details", conflict.errorMessage)

        if (app != null) {
            logEvent.addKeyValue("caller_app", app)
        }

        logEvent
            .log("Survey submission rejected because its definition conflicts with the registered definition")
    }

    private companion object {
        const val METRIC_NAME = "lumi_survey_definition_conflicts_total"
        val definitionConflictLog = LoggerFactory.getLogger("SurveyDefinitionConflict")
    }
}
