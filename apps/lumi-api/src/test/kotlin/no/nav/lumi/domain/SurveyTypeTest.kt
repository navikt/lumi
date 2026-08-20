package no.nav.lumi.domain

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe

class SurveyTypeTest : FunSpec({
    test("parses every public wire name and stored enum name") {
        val expected = mapOf(
            "rating" to SurveyType.RATING,
            "topTasks" to SurveyType.TOP_TASKS,
            "discovery" to SurveyType.DISCOVERY,
            "taskPriority" to SurveyType.TASK_PRIORITY,
            "custom" to SurveyType.CUSTOM,
            "RATING" to SurveyType.RATING,
            "TOP_TASKS" to SurveyType.TOP_TASKS,
            "DISCOVERY" to SurveyType.DISCOVERY,
            "TASK_PRIORITY" to SurveyType.TASK_PRIORITY,
            "CUSTOM" to SurveyType.CUSTOM,
        )

        expected.forEach { (wireName, surveyType) ->
            SurveyType.fromWireName(wireName) shouldBe surveyType
        }
        SurveyType.fromWireName("top-tasks") shouldBe null
        SurveyType.fromWireName(null) shouldBe null
    }
})
