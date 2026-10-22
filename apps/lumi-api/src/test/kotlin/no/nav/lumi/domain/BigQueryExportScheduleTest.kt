package no.nav.lumi.domain

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import java.time.Duration
import java.time.Instant

class BigQueryExportScheduleTest : FunSpec({
    val schedule = BigQueryExportSchedule()

    fun destination(
        lastRunStatus: BigQueryExportRunStatus? = null,
        lastSuccessAt: Instant? = null,
        lastRunFinishedAt: Instant? = null,
        runRequestedAt: Instant? = null,
        consecutiveFailures: Int = 0,
        stopRequestedAt: Instant? = null,
        stopAttemptedAt: Instant? = null,
        teamLastRunStartedAt: Instant? = null,
    ) = BigQueryExportDestination(
        team = "team-esyfo",
        projectId = "team-esyfo-prod-bbe6",
        datasetId = "lumi",
        includeFreeText = false,
        pseudonymKey = ByteArray(32),
        createdAt = Instant.parse("2026-10-01T10:00:00Z"),
        updatedAt = Instant.parse("2026-10-01T10:00:00Z"),
        runRequestedAt = runRequestedAt,
        lastRunStartedAt = lastRunFinishedAt?.minusSeconds(30),
        lastRunFinishedAt = lastRunFinishedAt,
        lastRunStatus = lastRunStatus,
        lastRunErrorCode = null,
        consecutiveFailures = consecutiveFailures,
        lastSuccessAt = lastSuccessAt,
        lastSuccessRows = null,
        stopRequestedAt = stopRequestedAt,
        stopAttemptedAt = stopAttemptedAt,
        teamLastRunStartedAt = teamLastRunStartedAt,
    )

    test("the nightly slot is 01:00 Norwegian time in summer and winter") {
        schedule.mostRecentSlot(Instant.parse("2026-07-01T12:00:00Z")) shouldBe Instant.parse("2026-06-30T23:00:00Z")
        schedule.mostRecentSlot(Instant.parse("2026-12-01T12:00:00Z")) shouldBe Instant.parse("2026-12-01T00:00:00Z")
        schedule.mostRecentSlot(Instant.parse("2026-12-01T23:30:00Z")) shouldBe Instant.parse("2026-12-01T00:00:00Z")
    }

    test("the nightly slot follows Norwegian time when the clocks change") {
        schedule.nextSlotAfter(Instant.parse("2026-10-24T12:00:00Z")) shouldBe Instant.parse("2026-10-24T23:00:00Z")
        schedule.nextSlotAfter(Instant.parse("2026-10-25T12:00:00Z")) shouldBe Instant.parse("2026-10-26T00:00:00Z")
    }

    test("a destination without any successful run is due") {
        schedule.isDue(destination(), Instant.parse("2026-10-20T12:00:00Z")) shouldBe true
    }

    test("a destination exported after the latest slot waits for the next night") {
        val now = Instant.parse("2026-10-20T12:00:00Z")
        schedule.isDue(destination(lastRunStatus = BigQueryExportRunStatus.SUCCEEDED, lastSuccessAt = Instant.parse("2026-10-20T00:05:00Z")), now) shouldBe false
        schedule.isDue(destination(lastRunStatus = BigQueryExportRunStatus.SUCCEEDED, lastSuccessAt = Instant.parse("2026-10-19T22:30:00Z")), now) shouldBe true
    }

    test("a requested run is due at once") {
        val now = Instant.parse("2026-10-20T12:00:00Z")
        schedule.isDue(
            destination(
                lastRunStatus = BigQueryExportRunStatus.SUCCEEDED,
                lastSuccessAt = Instant.parse("2026-10-20T11:00:00Z"),
                runRequestedAt = Instant.parse("2026-10-20T11:59:00Z"),
            ),
            now,
        ) shouldBe true
    }

    test("a requested run waits until five minutes after the previous start") {
        val previousStart = Instant.parse("2026-10-20T11:58:00Z")
        val requested = destination(
            lastRunStatus = BigQueryExportRunStatus.SUCCEEDED,
            lastSuccessAt = previousStart,
            lastRunFinishedAt = previousStart.plusSeconds(30),
            runRequestedAt = Instant.parse("2026-10-20T11:59:00Z"),
        )

        schedule.isDue(requested, Instant.parse("2026-10-20T12:02:59Z")) shouldBe false
        schedule.isDue(requested, Instant.parse("2026-10-20T12:03:00Z")) shouldBe true
        schedule.nextRunAt(requested, Instant.parse("2026-10-20T12:00:00Z")) shouldBe Instant.parse("2026-10-20T12:03:00Z")
    }

    test("the time between requested runs counts from the team's latest start, also after a move or a new setup") {
        val teamStart = Instant.parse("2026-10-20T11:58:00Z")
        val moved = destination(runRequestedAt = Instant.parse("2026-10-20T11:59:00Z"), teamLastRunStartedAt = teamStart)

        schedule.isDue(moved, Instant.parse("2026-10-20T12:02:59Z")) shouldBe false
        schedule.isDue(moved, Instant.parse("2026-10-20T12:03:00Z")) shouldBe true
        schedule.nextRunAt(moved, Instant.parse("2026-10-20T12:00:00Z")) shouldBe Instant.parse("2026-10-20T12:03:00Z")
    }

    test("a stopping export never runs, and a failed stop is tried again after five minutes") {
        val now = Instant.parse("2026-10-20T12:00:00Z")
        val stopping = destination(runRequestedAt = now.minusSeconds(600), stopRequestedAt = now.minusSeconds(60))

        schedule.isDue(stopping, now) shouldBe false
        schedule.isStopDue(stopping, now) shouldBe true
        schedule.isStopDue(destination(), now) shouldBe false

        val attempted = destination(stopRequestedAt = now.minusSeconds(600), stopAttemptedAt = now.minusSeconds(60))
        schedule.isStopDue(attempted, now) shouldBe false
        schedule.isStopDue(attempted, now.plusSeconds(240)) shouldBe true
    }

    test("a run marked as running is not due, because the service fails an interrupted run first") {
        schedule.isDue(destination(lastRunStatus = BigQueryExportRunStatus.RUNNING), Instant.parse("2026-10-20T12:00:00Z")) shouldBe false
    }

    test("failed runs wait one hour, then twice as long each time, up to a day") {
        schedule.retryDelay(1) shouldBe Duration.ofHours(1)
        schedule.retryDelay(2) shouldBe Duration.ofHours(2)
        schedule.retryDelay(4) shouldBe Duration.ofHours(8)
        schedule.retryDelay(6) shouldBe Duration.ofHours(24)
        schedule.retryDelay(40) shouldBe Duration.ofHours(24)

        val failedAt = Instant.parse("2026-10-20T10:00:00Z")
        val failed = destination(lastRunStatus = BigQueryExportRunStatus.FAILED, lastRunFinishedAt = failedAt, consecutiveFailures = 2)
        schedule.isDue(failed, failedAt.plus(Duration.ofMinutes(119))) shouldBe false
        schedule.isDue(failed, failedAt.plus(Duration.ofHours(2))) shouldBe true
        schedule.nextRunAt(failed, failedAt) shouldBe failedAt.plus(Duration.ofHours(2))
    }

    test("the next run shown to the team is never in the past") {
        val now = Instant.parse("2026-10-20T12:00:00Z")
        schedule.nextRunAt(destination(), now) shouldBe now
        schedule.nextRunAt(
            destination(lastRunStatus = BigQueryExportRunStatus.SUCCEEDED, lastSuccessAt = Instant.parse("2026-10-20T00:05:00Z")),
            now,
        ) shouldBe Instant.parse("2026-10-20T23:00:00Z")
        schedule.nextRunAt(
            destination(lastRunStatus = BigQueryExportRunStatus.SUCCEEDED, lastSuccessAt = Instant.parse("2026-10-10T00:05:00Z")),
            now,
        ) shouldBe now
    }
})
