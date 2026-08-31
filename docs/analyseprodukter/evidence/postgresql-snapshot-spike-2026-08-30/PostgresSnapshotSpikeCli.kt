package no.nav.lumi.prototype.analyticsdb

import kotlin.system.exitProcess

private data class CliState(
    val postgresVersion: String,
    val status: String,
    val consistency: ConsistencyObservation? = null,
    val load: LoadObservation? = null,
)

fun main(args: Array<String>) {
    PostgresSnapshotSpike().use { spike ->
        if ("--verify" in args) {
            runVerification(spike)
        } else {
            runInteractive(spike)
        }
    }
}

private fun runVerification(spike: PostgresSnapshotSpike) {
    val (checks, loads) = spike.runAllVerifications()
    checks.forEach { check ->
        println("${if (check.passed) "PASS" else "FAIL"} ${check.name}: ${check.detail}")
    }
    println()
    loads.forEach(::printLoad)
    println()
    println("Boundary: timings and buffers are from a disposable local container, not Cloud SQL or federation.")
    if (checks.any { !it.passed }) exitProcess(1)
}

private fun runInteractive(spike: PostgresSnapshotSpike) {
    var state = CliState(spike.postgresVersion, "Scratch PostgreSQL is ready")
    while (true) {
        render(state)
        state = when (readlnOrNull()?.trim()?.lowercase()) {
            "c" -> runCatching { spike.verifyConsistency() }
                .fold(
                    onSuccess = { state.copy(status = "Consistency scenario passed", consistency = it, load = null) },
                    onFailure = { state.copy(status = "Consistency scenario failed: ${it.message}") },
                )
            "1" -> runLoad(spike, state, "1x representative overlap", 27_571, 2)
            "x" -> runLoad(spike, state, "10x representative overlap", 275_710, 2)
            "w" -> runLoad(spike, state, "10x worst allowed overlap", 275_710, 10)
            "v" -> {
                val (checks, loads) = spike.runAllVerifications()
                state.copy(
                    status = "Verification ${checks.count { it.passed }}/${checks.size} passed",
                    consistency = null,
                    load = loads.last(),
                )
            }
            "q", null -> return
            else -> state.copy(status = "Unknown command")
        }
    }
}

private fun runLoad(
    spike: PostgresSnapshotSpike,
    state: CliState,
    label: String,
    rows: Int,
    overlap: Int,
): CliState = runCatching { spike.runLoadScenario(label, rows, overlap) }
    .fold(
        onSuccess = { state.copy(status = "$label passed", consistency = null, load = it) },
        onFailure = { state.copy(status = "$label failed: ${it.message}") },
    )

private fun render(state: CliState) {
    print("\u001B[H\u001B[2J")
    println("Lumi PostgreSQL source-snapshot spike — local scratch database")
    println("PostgreSQL: ${state.postgresVersion}")
    println()
    state.consistency?.let { observation ->
        println("Consistency")
        println("  established snapshot: epoch=${observation.snapshotControlEpoch}, rows=${observation.snapshotSubmissionRows}")
        println("  committed state:      epoch=${observation.committedControlEpoch}, rows=${observation.committedSubmissionRows}")
        println("  raw feedback:          ${observation.initialRawFeedbackRows} -> ${observation.committedRawFeedbackRows}")
        println()
    }
    state.load?.let { observation ->
        println("Load: ${observation.label}")
        println("  source rows:       ${observation.sourceRows}")
        println("  products/overlap:  ${observation.products}/${observation.overlapPerSource}")
        println("  logical rows:      ${observation.counts.logicalRows}")
        println("  query execution:   ${"%.1f".format(observation.plan.executionTimeMs)} ms")
        println("  feedback scans:    ${observation.plan.feedbackRelationScans}")
        observation.plan.feedbackPlanNodes.forEach { node ->
            println(
                "    ${node.nodeType}${node.indexName?.let { "[$it]" }.orEmpty()}: " +
                    "loops=${node.actualLoops}, rows/loop=${node.actualRowsPerLoop}, " +
                    "visited=${node.visitedRows}",
            )
        }
        println("  buffers hit/read:  ${observation.plan.sharedHitBlocks}/${observation.plan.sharedReadBlocks}")
        println("  temp read/written: ${observation.plan.tempReadBlocks}/${observation.plan.tempWrittenBlocks}")
        println("  feedback total:    ${formatBytes(observation.size.feedbackTotalBytes)}")
        println()
    }
    println(state.status)
    println()
    println("[c] consistency  [1] 1x/2 overlap  [x] 10x/2 overlap")
    println("[w] 10x/10 overlap  [v] verify all  [q] quit")
    print("> ")
}

private fun printLoad(observation: LoadObservation) {
    println(
        "SCALE ${observation.label}: source=${observation.sourceRows}, products=${observation.products}, " +
            "overlap=${observation.overlapPerSource}, memberships=${observation.counts.count("MEMBERSHIP")}, " +
            "logicalRows=${observation.counts.logicalRows}, execution=${"%.1f".format(observation.plan.executionTimeMs)}ms, " +
        "feedbackScans=${observation.plan.feedbackRelationScans}, " +
            "feedbackPlan=${observation.plan.feedbackPlanNodes.joinToString(";") { node ->
                "${node.nodeType}[${node.indexName ?: "-"}] loops=${node.actualLoops} " +
                    "rowsPerLoop=${node.actualRowsPerLoop} visited=${node.visitedRows}"
            }}, " +
            "buffers(hit/read)=${observation.plan.sharedHitBlocks}/${observation.plan.sharedReadBlocks}, " +
            "temp(read/written)=${observation.plan.tempReadBlocks}/${observation.plan.tempWrittenBlocks}, " +
            "feedbackTotal=${formatBytes(observation.size.feedbackTotalBytes)}",
    )
}

private fun formatBytes(bytes: Long): String = when {
    bytes >= 1024L * 1024L -> "%.1f MiB".format(bytes.toDouble() / (1024 * 1024))
    bytes >= 1024L -> "%.1f KiB".format(bytes.toDouble() / 1024)
    else -> "$bytes B"
}
