package no.nav.lumi.service

import io.kotest.core.spec.style.FunSpec
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import no.nav.lumi.config.RetentionObservability
import no.nav.lumi.repository.FeedbackRetentionBatchResult
import no.nav.lumi.repository.FeedbackRetentionRepository
import no.nav.lumi.repository.FeedbackRetentionResult
import no.nav.lumi.repository.FeedbackRetentionSkipReason
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneOffset

class FeedbackRetentionServiceTest : FunSpec({
    test("requests a 12 calendar month cutoff and records completion") {
        val now = Instant.parse("2026-02-28T12:00:00Z")
        val expectedCutoff = Instant.parse("2025-02-28T12:00:00Z")
        val repository = mockk<FeedbackRetentionRepository>()
        val observability = mockk<RetentionObservability>()
        val statsCacheInvalidator = mockk<StatsCacheInvalidator>()
        val bootstrapCacheInvalidator = mockk<BootstrapCacheInvalidator>()
        val service = FeedbackRetentionService(
            repository = repository,
            observability = observability,
            statsCacheInvalidator = statsCacheInvalidator,
            bootstrapCacheInvalidator = bootstrapCacheInvalidator,
            clock = Clock.fixed(now, ZoneOffset.UTC),
            batchSize = 25,
        )
        val expectedResult = FeedbackRetentionResult(
            executed = true,
            cutoff = expectedCutoff,
            deletedFeedback = 3,
            affectedTeams = setOf("team-b", "team-a"),
        )

        every {
            repository.deleteExpiredFeedback(12, Duration.ofDays(1), 25, any())
        } answers {
            lastArg<(FeedbackRetentionBatchResult) -> Unit>().invoke(
                FeedbackRetentionBatchResult(3, setOf("team-b", "team-a")),
            )
            expectedResult
        }
        every { statsCacheInvalidator.invalidateTeam(any()) } returns Unit
        every { bootstrapCacheInvalidator.invalidateTeam(any()) } returns Unit
        every { observability.recordDeletedFeedback(3) } returns Unit
        every { observability.recordExecuted(now) } returns Unit

        service.runOnce() shouldBe expectedResult

        verify(exactly = 1) {
            repository.deleteExpiredFeedback(12, Duration.ofDays(1), 25, any())
        }
        verify(exactly = 1) { statsCacheInvalidator.invalidateTeam("team-a") }
        verify(exactly = 1) { statsCacheInvalidator.invalidateTeam("team-b") }
        verify(exactly = 1) { bootstrapCacheInvalidator.invalidateTeam("team-a") }
        verify(exactly = 1) { bootstrapCacheInvalidator.invalidateTeam("team-b") }
        verify(exactly = 1) { observability.recordDeletedFeedback(3) }
        verify(exactly = 1) { observability.recordExecuted(now) }
    }

    test("publishes a committed batch before a later cleanup failure") {
        val now = Instant.parse("2026-02-28T12:00:00Z")
        val repository = mockk<FeedbackRetentionRepository>()
        val observability = mockk<RetentionObservability>()
        val statsCacheInvalidator = mockk<StatsCacheInvalidator>()
        val bootstrapCacheInvalidator = mockk<BootstrapCacheInvalidator>()
        val service = FeedbackRetentionService(
            repository = repository,
            observability = observability,
            statsCacheInvalidator = statsCacheInvalidator,
            bootstrapCacheInvalidator = bootstrapCacheInvalidator,
            clock = Clock.fixed(now, ZoneOffset.UTC),
            batchSize = 25,
        )
        val failure = IllegalStateException("later batch failed")

        every {
            repository.deleteExpiredFeedback(12, Duration.ofDays(1), 25, any())
        } answers {
            lastArg<(FeedbackRetentionBatchResult) -> Unit>().invoke(
                FeedbackRetentionBatchResult(2, setOf("team-a")),
            )
            throw failure
        }
        every { statsCacheInvalidator.invalidateTeam("team-a") } returns Unit
        every { bootstrapCacheInvalidator.invalidateTeam("team-a") } returns Unit
        every { observability.recordDeletedFeedback(2) } returns Unit
        every { observability.recordFailed() } returns Unit

        shouldThrow<IllegalStateException> { service.runOnce() } shouldBe failure

        verify(exactly = 1) { statsCacheInvalidator.invalidateTeam("team-a") }
        verify(exactly = 1) { bootstrapCacheInvalidator.invalidateTeam("team-a") }
        verify(exactly = 1) { observability.recordDeletedFeedback(2) }
        verify(exactly = 1) { observability.recordFailed() }
        verify(exactly = 0) { observability.recordExecuted(any()) }
    }

    test("records a globally rate-limited attempt as skipped") {
        val now = Instant.parse("2026-02-28T12:00:00Z")
        val repository = mockk<FeedbackRetentionRepository>()
        val observability = mockk<RetentionObservability>()
        val service = FeedbackRetentionService(
            repository = repository,
            observability = observability,
            statsCacheInvalidator = mockk(),
            bootstrapCacheInvalidator = mockk(),
            clock = Clock.fixed(now, ZoneOffset.UTC),
        )
        val expectedResult = FeedbackRetentionResult(
            executed = false,
            skipReason = FeedbackRetentionSkipReason.MINIMUM_INTERVAL_NOT_ELAPSED,
        )

        every {
            repository.deleteExpiredFeedback(
                12,
                Duration.ofDays(1),
                FeedbackRetentionRepository.MAX_DELETE_BATCH_SIZE,
                any(),
            )
        } returns expectedResult
        every { observability.recordSkipped() } returns Unit

        service.runOnce() shouldBe expectedResult

        verify(exactly = 1) { observability.recordSkipped() }
        verify(exactly = 0) { observability.recordExecuted(any()) }
        verify(exactly = 0) { observability.recordFailed() }
    }
})
