package no.nav.lumi.repository

import no.nav.lumi.domain.AnswerValue
import no.nav.lumi.domain.DailyStat
import no.nav.lumi.domain.FeedbackDto
import no.nav.lumi.domain.TopTaskStats
import no.nav.lumi.domain.TopTasksResponse
import java.time.LocalDate

internal fun processTopTasks(feedbacks: List<FeedbackDto>): TopTasksResponse {
    val taskStatsMap = mutableMapOf<String, MutableMap<String, Int>>()
    var totalSubmissions = 0
    val dailyStats = mutableMapOf<String, MutableMap<String, Int>>()
    var questionText: String? = null

    feedbacks.forEach { dto ->
        val taskAnswer = dto.answers.find { it.fieldId == "task" }
        if (taskAnswer == null) return@forEach

        totalSubmissions++

        val taskLabel = when (val v = taskAnswer.value) {
            is AnswerValue.SingleChoice -> {
                val optId = v.selectedOptionId
                taskAnswer.question.options?.find { it.id == optId }?.label ?: optId
            }
            is AnswerValue.Text -> v.text
            else -> "Ukjent oppgave"
        }

        if (questionText == null) {
            questionText = taskAnswer.question.label
        }

        val successAnswer = dto.answers.find { it.fieldId == "taskSuccess" }
        val successValue = when (val v = successAnswer?.value) {
            is AnswerValue.SingleChoice -> v.selectedOptionId // "yes", "partial", "no"
            else -> null
        }

        val blockerAnswer = dto.answers.find { it.fieldId == "blocker" }
        val blockerValue = when (val v = blockerAnswer?.value) {
            is AnswerValue.SingleChoice -> v.selectedOptionId
            is AnswerValue.Text -> v.text
            else -> null
        }

        // Daily stats
        val dateStr = LocalDate.parse(dto.submittedAt.substring(0, 10)).toString()
        val dayStat = dailyStats.getOrPut(dateStr) { mutableMapOf("total" to 0, "success" to 0) }
        dayStat["total"] = (dayStat["total"] ?: 0) + 1
        if (successValue == "yes") {
            dayStat["success"] = (dayStat["success"] ?: 0) + 1
        }

        // Task stats
        val stats = taskStatsMap.getOrPut(taskLabel) {
            mutableMapOf("total" to 0, "success" to 0, "partial" to 0, "failure" to 0)
        }
        stats["total"] = (stats["total"] ?: 0) + 1
        when (successValue) {
            "yes" -> stats["success"] = (stats["success"] ?: 0) + 1
            "partial" -> stats["partial"] = (stats["partial"] ?: 0) + 1
            "no" -> stats["failure"] = (stats["failure"] ?: 0) + 1
        }

        if ((successValue == "no" || successValue == "partial") && !blockerValue.isNullOrBlank()) {
            val blockerKey = "blocker_$blockerValue"
            stats[blockerKey] = (stats[blockerKey] ?: 0) + 1
        }
    }

    val taskStatsList = taskStatsMap.map { (task, stats) ->
        val total = stats["total"] ?: 0
        val success = stats["success"] ?: 0
        val partial = stats["partial"] ?: 0
        val failure = stats["failure"] ?: 0
        val successRate = if (total > 0) (success.toDouble() / total.toDouble()) else 0.0
        val formattedRate = "${(successRate * 100).toInt()}%"
        val blockers = stats.filterKeys { it.startsWith("blocker_") }.mapKeys { it.key.removePrefix("blocker_") }

        TopTaskStats(task, total, success, partial, failure, successRate, formattedRate, blockers)
    }.sortedByDescending { it.totalCount }

    val dailyStatsResult = dailyStats.mapValues { (_, v) ->
        DailyStat(v["total"] ?: 0, v["success"] ?: 0)
    }

    return TopTasksResponse(totalSubmissions, taskStatsList, dailyStatsResult, questionText)
}
