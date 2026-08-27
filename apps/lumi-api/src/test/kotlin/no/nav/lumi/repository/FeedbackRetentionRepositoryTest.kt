package no.nav.lumi.repository

import io.kotest.core.spec.style.FunSpec
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.shouldBe
import no.nav.lumi.TestDatabase
import java.time.Instant
import java.sql.Timestamp

class FeedbackRetentionRepositoryTest : FunSpec({
    beforeSpec {
        TestDatabase.initialize()
    }

    beforeTest {
        TestDatabase.clearAllData()
    }

    test("deletes only one bounded batch of feedback strictly older than cutoff") {
        val cutoff = Instant.parse("2025-08-26T12:00:00Z")
        insertFeedback("old-1", cutoff.minusSeconds(2), "team-a")
        insertFeedback("old-2", cutoff.minusSeconds(1), "team-b")
        insertFeedback("boundary", cutoff, "team-a")
        insertFeedback("new", cutoff.plusSeconds(1), "team-a")
        insertTag("old-1", "expired")
        insertTag("boundary", "kept")

        val repository = FeedbackRetentionRepository(TestDatabase.dataSource)
        val firstResult = repository
            .deleteExpiredFeedback(cutoff, batchSize = 1)

        firstResult shouldBe FeedbackRetentionResult(
            executed = true,
            deletedFeedback = 1,
            affectedTeams = setOf("team-a"),
        )
        remainingFeedbackIds() shouldContainExactlyInAnyOrder listOf("old-2", "boundary", "new")
        remainingTagFeedbackIds() shouldContainExactlyInAnyOrder listOf("boundary")

        val secondResult = repository.deleteExpiredFeedback(cutoff, batchSize = 1)

        secondResult shouldBe FeedbackRetentionResult(
            executed = true,
            deletedFeedback = 1,
            affectedTeams = setOf("team-b"),
        )
        remainingFeedbackIds() shouldContainExactlyInAnyOrder listOf("boundary", "new")
    }

    test("rejects a batch size above the defensive per-run limit") {
        shouldThrow<IllegalArgumentException> {
            FeedbackRetentionRepository(TestDatabase.dataSource).deleteExpiredFeedback(
                cutoff = Instant.parse("2025-08-26T12:00:00Z"),
                batchSize = FeedbackRetentionRepository.MAX_DELETE_BATCH_SIZE + 1,
            )
        }.message shouldBe "batchSize must be between 1 and 500"
    }

    test("skips cleanup when another connection holds the advisory lock") {
        val lockConnection = TestDatabase.dataSource.connection
        try {
            lockConnection.prepareStatement("SELECT pg_advisory_lock(?)").use { statement ->
                statement.setLong(1, FeedbackRetentionRepository.CLEANUP_LOCK_ID)
                statement.execute()
            }

            val result = FeedbackRetentionRepository(TestDatabase.dataSource)
                .deleteExpiredFeedback(Instant.parse("2025-08-26T12:00:00Z"), batchSize = 10)

            result shouldBe FeedbackRetentionResult(executed = false)
        } finally {
            lockConnection.prepareStatement("SELECT pg_advisory_unlock(?)").use { statement ->
                statement.setLong(1, FeedbackRetentionRepository.CLEANUP_LOCK_ID)
                statement.execute()
            }
            lockConnection.commit()
            lockConnection.close()
        }
    }

    test("publishes a batch only after its deletion is committed") {
        val cutoff = Instant.parse("2025-08-26T12:00:00Z")
        insertFeedback("first", cutoff.minusSeconds(2), "team-a")
        insertFeedback("second", cutoff.minusSeconds(1), "team-b")
        val published = mutableListOf<FeedbackRetentionBatchResult>()

        shouldThrow<IllegalStateException> {
            FeedbackRetentionRepository(TestDatabase.dataSource)
                .deleteExpiredFeedback(cutoff, batchSize = 1) { batch ->
                    published += batch
                    error("stop after committed batch")
                }
        }

        published shouldBe listOf(
            FeedbackRetentionBatchResult(
                deletedFeedback = 1,
                affectedTeams = setOf("team-a"),
            ),
        )
        remainingFeedbackIds() shouldBe listOf("second")
    }
})

private fun insertFeedback(id: String, createdAt: Instant, team: String) {
    TestDatabase.dataSource.connection.use { connection ->
        connection.prepareStatement(
            """
                INSERT INTO feedback (id, opprettet, feedback_json, team, app)
                VALUES (?, ?, '{}'::jsonb, ?, 'app-a')
            """.trimIndent()
        ).use { statement ->
            statement.setString(1, id)
            statement.setTimestamp(2, Timestamp.from(createdAt))
            statement.setString(3, team)
            statement.executeUpdate()
        }
        connection.commit()
    }
}

private fun insertTag(feedbackId: String, tag: String) {
    TestDatabase.dataSource.connection.use { connection ->
        connection.prepareStatement(
            "INSERT INTO feedback_tag (feedback_id, tag) VALUES (?, ?)"
        ).use { statement ->
            statement.setString(1, feedbackId)
            statement.setString(2, tag)
            statement.executeUpdate()
        }
        connection.commit()
    }
}

private fun remainingFeedbackIds(): List<String> =
    TestDatabase.dataSource.connection.use { connection ->
        connection.createStatement().use { statement ->
            statement.executeQuery("SELECT id FROM feedback").use { result ->
                buildList {
                    while (result.next()) add(result.getString("id"))
                }
            }
        }
    }

private fun remainingTagFeedbackIds(): List<String> =
    TestDatabase.dataSource.connection.use { connection ->
        connection.createStatement().use { statement ->
            statement.executeQuery("SELECT feedback_id FROM feedback_tag").use { result ->
                buildList {
                    while (result.next()) add(result.getString("feedback_id"))
                }
            }
        }
    }
