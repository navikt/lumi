package no.nav.lumi.repository

import kotlinx.serialization.json.*
import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.domain.RedactFeedbackInput
import no.nav.lumi.domain.redactTextRanges
import no.nav.lumi.domain.textRedactionHash
import no.nav.lumi.sensitive.SensitiveDataFilter
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.time.Instant

class FeedbackRedactionRepository(
    private val exportRepository: BigQueryExportRepository = BigQueryExportRepository(),
) {
    private val json = Json

    suspend fun generation(team: String): Long = dbQuery {
        connection().prepareStatement("SELECT generation FROM feedback_redaction.team_state WHERE team = ?").use { statement ->
            statement.setString(1, team)
            statement.executeQuery().use { result -> if (result.next()) result.getLong(1) else 0L }
        }
    }

    /** Text, cache generation and export request commit or roll back together. */
    suspend fun redact(id: String, team: String, input: RedactFeedbackInput): Boolean = dbQuery {
        input.validate()
        val stored = connection().prepareStatement(
            "SELECT feedback_json::text FROM feedback WHERE id = ? AND team = ? FOR UPDATE",
        ).use { statement ->
            statement.setString(1, id)
            statement.setString(2, team)
            statement.executeQuery().use { result -> if (result.next()) result.getString(1) else null }
        } ?: return@dbQuery false

        val document = runCatching { json.parseToJsonElement(stored) as? JsonObject }.getOrNull()
            ?: throw ApiErrorException.InternalServerErrorException("Tilbakemeldingen kunne ikke leses.")
        val answers = document["answers"] as? JsonArray ?: invalidAnswer()
        val indexes = answers.indices.filter { index ->
            ((answers[index] as? JsonObject)?.get("fieldId") as? JsonPrimitive)?.contentOrNull == input.fieldId
        }
        if (indexes.size != 1) invalidAnswer()
        val index = indexes.single()
        val answer = answers[index].jsonObject
        val value = answer["value"] as? JsonObject ?: invalidAnswer()
        if ((answer["fieldType"] as? JsonPrimitive)?.contentOrNull != "TEXT" ||
            (value["type"] as? JsonPrimitive)?.contentOrNull != "text"
        ) invalidAnswer()
        val rawText = (value["text"] as? JsonPrimitive)?.takeIf { it.isString }?.contentOrNull ?: invalidAnswer()
        // The browser selects the read-time-redacted text, whose offsets may
        // differ from old stored text. Never reintroduce hidden PII.
        val visibleText = SensitiveDataFilter.DEFAULT.redact(rawText).redactedText
        if (textRedactionHash(visibleText) != input.expectedTextHash) {
            throw ApiErrorException.ConflictException("Svaret er endret. Last det inn på nytt før du maskerer.")
        }
        val masked = redactTextRanges(visibleText, input.ranges)
        val changedAnswer = JsonObject(answer + ("value" to JsonObject(value + ("text" to JsonPrimitive(masked)))))
        val changed = JsonObject(document + mapOf(
            "answers" to JsonArray(answers.mapIndexed { i, item -> if (i == index) changedAnswer else item }),
            "sensitiveDataRedacted" to JsonPrimitive(true),
        ))

        connection().prepareStatement(
            "UPDATE feedback SET feedback_json = ?::jsonb WHERE id = ? AND team = ?",
        ).use { statement ->
            statement.setString(1, changed.toString())
            statement.setString(2, id)
            statement.setString(3, team)
            check(statement.executeUpdate() == 1)
        }
        // Serialize generations per team, including the first concurrent masks.
        // Late cache writes stay on an old key, also on other replicas.
        connection().prepareStatement(
            """
            INSERT INTO feedback_redaction.team_state(team, generation) VALUES (?, 1)
            ON CONFLICT (team) DO UPDATE SET generation = team_state.generation + 1
            """.trimIndent(),
        ).use { statement ->
            statement.setString(1, team)
            check(statement.executeUpdate() == 1)
        }
        exportRepository.requestRun(team, Instant.now())
        true
    }

    private fun connection(): java.sql.Connection =
        TransactionManager.current().connection.connection as java.sql.Connection

    private fun invalidAnswer(): Nothing =
        throw ApiErrorException.BadRequestException("Velg ett eksisterende fritekstsvar.")
}
