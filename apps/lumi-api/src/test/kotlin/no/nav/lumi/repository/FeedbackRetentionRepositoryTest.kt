package no.nav.lumi.repository

import io.kotest.core.spec.style.FunSpec
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import no.nav.lumi.TestDatabase
import java.sql.SQLException
import java.sql.Timestamp
import java.time.Duration
import java.time.Instant

class FeedbackRetentionRepositoryTest : FunSpec({
    beforeSpec {
        TestDatabase.initialize()
    }

    beforeTest {
        TestDatabase.clearAllData()
    }

    test("deletes only one bounded batch of feedback strictly older than cutoff") {
        val cutoff = databaseRetentionCutoff()
        insertFeedback("old-1", cutoff.minusSeconds(120), "team-a")
        insertFeedback("old-2", cutoff.minusSeconds(60), "team-b")
        insertFeedback("inside-window", cutoff.plusSeconds(60), "team-a")
        insertFeedback("new", cutoff.plusSeconds(3600), "team-a")
        insertTag("old-1", "expired")
        insertTag("inside-window", "kept")

        val repository = FeedbackRetentionRepository(TestDatabase.dataSource)
        val firstResult = repository
            .deleteExpiredFeedback(
                retentionMonths = 12,
                minimumInterval = Duration.ofDays(1),
                batchSize = 1,
            )

        firstResult.cutoff shouldNotBe null
        firstResult.lastCompletedAt shouldBe retentionJobLastCompletedAt()
        firstResult.copy(cutoff = null, lastCompletedAt = null) shouldBe FeedbackRetentionResult(
            executed = true,
            deletedFeedback = 1,
            affectedTeams = setOf("team-a"),
        )
        remainingFeedbackIds() shouldContainExactlyInAnyOrder listOf("old-2", "inside-window", "new")
        remainingTagFeedbackIds() shouldContainExactlyInAnyOrder listOf("inside-window")

        val persistedCompletion = ageCleanupState(Duration.ofHours(23))

        val restartResult = FeedbackRetentionRepository(TestDatabase.dataSource)
            .deleteExpiredFeedback(
                retentionMonths = 12,
                minimumInterval = Duration.ofDays(1),
                batchSize = 1,
            )

        restartResult shouldBe FeedbackRetentionResult(
            executed = false,
            skipReason = FeedbackRetentionSkipReason.MINIMUM_INTERVAL_NOT_ELAPSED,
            lastCompletedAt = persistedCompletion,
        )
        remainingFeedbackIds() shouldContainExactlyInAnyOrder listOf("old-2", "inside-window", "new")

        ageCleanupState(Duration.ofDays(1).plusSeconds(1))

        val secondResult = FeedbackRetentionRepository(TestDatabase.dataSource)
            .deleteExpiredFeedback(
                retentionMonths = 12,
                minimumInterval = Duration.ofDays(1),
                batchSize = 1,
            )

        secondResult.cutoff shouldNotBe null
        secondResult.lastCompletedAt shouldNotBe null
        secondResult.copy(cutoff = null, lastCompletedAt = null) shouldBe FeedbackRetentionResult(
            executed = true,
            deletedFeedback = 1,
            affectedTeams = setOf("team-b"),
        )
        remainingFeedbackIds() shouldContainExactlyInAnyOrder listOf("inside-window", "new")
    }

    test("rejects a batch size above the defensive per-run limit") {
        shouldThrow<IllegalArgumentException> {
            FeedbackRetentionRepository(TestDatabase.dataSource).deleteExpiredFeedback(
                retentionMonths = 12,
                minimumInterval = Duration.ofDays(1),
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
                .deleteExpiredFeedback(
                    retentionMonths = 12,
                    minimumInterval = Duration.ofDays(1),
                    batchSize = 10,
                )

            result shouldBe FeedbackRetentionResult(
                executed = false,
                skipReason = FeedbackRetentionSkipReason.LOCK_HELD,
            )
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
        val cutoff = databaseRetentionCutoff()
        insertFeedback("first", cutoff.minusSeconds(120), "team-a")
        insertFeedback("second", cutoff.minusSeconds(60), "team-b")
        val published = mutableListOf<FeedbackRetentionBatchResult>()

        shouldThrow<IllegalStateException> {
            FeedbackRetentionRepository(TestDatabase.dataSource)
                .deleteExpiredFeedback(
                    retentionMonths = 12,
                    minimumInterval = Duration.ofDays(1),
                    batchSize = 1,
                ) { batch ->
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

        FeedbackRetentionRepository(TestDatabase.dataSource).deleteExpiredFeedback(
            retentionMonths = 12,
            minimumInterval = Duration.ofDays(1),
            batchSize = 1,
        ).copy(lastCompletedAt = null) shouldBe FeedbackRetentionResult(
            executed = false,
            skipReason = FeedbackRetentionSkipReason.MINIMUM_INTERVAL_NOT_ELAPSED,
        )
        remainingFeedbackIds() shouldBe listOf("second")
    }

    test("rolls back deletion when retention job state cannot be written") {
        val cutoff = databaseRetentionCutoff()
        insertFeedback("kept-after-rollback", cutoff.minusSeconds(60), "team-a")
        installRejectingStateTrigger()

        try {
            shouldThrow<SQLException> {
                FeedbackRetentionRepository(TestDatabase.dataSource).deleteExpiredFeedback(
                    retentionMonths = 12,
                    minimumInterval = Duration.ofDays(1),
                    batchSize = 1,
                )
            }

            remainingFeedbackIds() shouldBe listOf("kept-after-rollback")
            retentionJobStateCount() shouldBe 0
        } finally {
            removeRejectingStateTrigger()
        }
    }
})

private fun databaseRetentionCutoff(): Instant =
    TestDatabase.dataSource.connection.use { connection ->
        connection.prepareStatement(
            """
                SELECT (
                    clock_timestamp() AT TIME ZONE 'UTC' - make_interval(months => 12)
                ) AT TIME ZONE 'UTC' AS cutoff
            """.trimIndent()
        ).use { statement ->
            statement.executeQuery().use { result ->
                check(result.next())
                result.getTimestamp("cutoff").toInstant()
            }
        }
    }

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

private fun ageCleanupState(age: Duration): Instant =
    TestDatabase.dataSource.connection.use { connection ->
        val completedAt = connection.prepareStatement(
            """
                UPDATE feedback_retention_job_state
                SET last_completed_at = clock_timestamp() - (? * INTERVAL '1 millisecond')
                WHERE job_name = 'feedback-cleanup'
                RETURNING last_completed_at
            """.trimIndent()
        ).use { statement ->
            statement.setLong(1, age.toMillis())
            statement.executeQuery().use { result ->
                check(result.next())
                result.getTimestamp("last_completed_at").toInstant()
            }
        }
        connection.commit()
        completedAt
    }

private fun retentionJobLastCompletedAt(): Instant =
    TestDatabase.dataSource.connection.use { connection ->
        connection.prepareStatement(
            """
                SELECT last_completed_at
                FROM feedback_retention_job_state
                WHERE job_name = 'feedback-cleanup'
            """.trimIndent()
        ).use { statement ->
            statement.executeQuery().use { result ->
                check(result.next())
                result.getTimestamp("last_completed_at").toInstant()
            }
        }
    }

private fun installRejectingStateTrigger() {
    TestDatabase.dataSource.connection.use { connection ->
        connection.createStatement().use { statement ->
            statement.execute(
                """
                    CREATE FUNCTION reject_retention_state_write()
                    RETURNS trigger
                    AS 'BEGIN RAISE EXCEPTION ''forced retention state failure''; END;'
                    LANGUAGE plpgsql
                """.trimIndent()
            )
            statement.execute(
                """
                    CREATE TRIGGER reject_retention_state_write
                    BEFORE INSERT OR UPDATE ON feedback_retention_job_state
                    FOR EACH ROW EXECUTE FUNCTION reject_retention_state_write()
                """.trimIndent()
            )
        }
        connection.commit()
    }
}

private fun removeRejectingStateTrigger() {
    TestDatabase.dataSource.connection.use { connection ->
        connection.createStatement().use { statement ->
            statement.execute("DROP TRIGGER IF EXISTS reject_retention_state_write ON feedback_retention_job_state")
            statement.execute("DROP FUNCTION IF EXISTS reject_retention_state_write()")
        }
        connection.commit()
    }
}

private fun retentionJobStateCount(): Int =
    TestDatabase.dataSource.connection.use { connection ->
        connection.createStatement().use { statement ->
            statement.executeQuery("SELECT COUNT(*) FROM feedback_retention_job_state").use { result ->
                check(result.next())
                result.getInt(1)
            }
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
