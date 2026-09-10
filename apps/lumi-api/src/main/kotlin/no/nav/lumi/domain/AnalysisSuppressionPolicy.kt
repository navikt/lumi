package no.nav.lumi.domain

import kotlinx.serialization.Serializable
import java.math.BigInteger

@Serializable
data class AnalysisCountCell(val id: String, val count: Long)

@Serializable
data class AnalysisCountEquation(val totalId: String, val componentIds: Set<String>)

@Serializable
enum class AnalysisCountStatus {
    EXACT,
    BELOW_THRESHOLD,
}

@Serializable
data class AnalysisPublishedCountCell(
    val id: String,
    val value: Long?,
    val status: AnalysisCountStatus,
)

/**
 * Pure policy for a future fixed aggregate preview. It deliberately has no
 * repository or route integration: live aggregate publication needs a
 * separately reviewed, snapshot-sticky cell model first.
 */
class AnalysisSuppressionPolicyV1 {
    fun apply(
        cells: List<AnalysisCountCell>,
        equations: List<AnalysisCountEquation> = emptyList(),
    ): List<AnalysisPublishedCountCell> {
        require(cells.map { it.id }.distinct().size == cells.size) { "Count cell IDs must be unique" }
        require(cells.all { it.count >= 0 }) { "Counts cannot be negative" }

        val counts = cells.associate { it.id to it.count }
        equations.forEach { equation ->
            require(equation.totalId in counts) { "Unknown total cell" }
            require(equation.componentIds.isNotEmpty()) { "An equation needs components" }
            require(equation.componentIds.all { it in counts }) { "Unknown component cell" }
            require(equation.totalId !in equation.componentIds) { "A total cannot be its own component" }
            require(equation.componentIds.sumOf { counts.getValue(it) } == counts.getValue(equation.totalId)) {
                "Count equation is not additive"
            }
        }

        val protected = cells
            .filter { it.count in 1..4 }
            .mapTo(linkedSetOf(), AnalysisCountCell::id)
        val suppressed = protected.toMutableSet()

        while (true) {
            val identifiable = identifiableCells(protected, suppressed, equations)
            if (identifiable.isEmpty()) break

            val connected = connectedCells(identifiable, equations)
            val componentIds = equations.flatMapTo(mutableSetOf()) { it.componentIds }
            val secondary = cells
                .asSequence()
                .filter { it.id !in suppressed && it.id in connected }
                .sortedWith(
                    compareByDescending<AnalysisCountCell> { it.id in componentIds }
                        .thenByDescending { it.count }
                        .thenBy { it.id },
                )
                .firstOrNull()
                ?: error("Identifiable suppressed cell has no publishable secondary cell")
            suppressed += secondary.id
        }

        return cells.sortedBy { it.id }.map { cell ->
            if (cell.id in suppressed) {
                AnalysisPublishedCountCell(cell.id, null, AnalysisCountStatus.BELOW_THRESHOLD)
            } else {
                AnalysisPublishedCountCell(cell.id, cell.count, AnalysisCountStatus.EXACT)
            }
        }
    }

    private fun identifiableCells(
        protected: Set<String>,
        suppressed: Set<String>,
        equations: List<AnalysisCountEquation>,
    ): Set<String> {
        val columns = suppressed.sorted()
        val fullRank = coefficientRank(columns, equations)
        return protected.sorted().filterTo(linkedSetOf()) { candidate ->
            fullRank > coefficientRank(columns.filterNot { it == candidate }, equations)
        }
    }

    private fun coefficientRank(
        columns: List<String>,
        equations: List<AnalysisCountEquation>,
    ): Int {
        if (columns.isEmpty()) return 0
        val coefficients = equations.map { equation ->
            columns.map { cellId ->
                when {
                    cellId == equation.totalId -> 1
                    cellId in equation.componentIds -> -1
                    else -> 0
                }
            }
        }
        return exactRank(coefficients)
    }

    private fun connectedCells(
        seeds: Set<String>,
        equations: List<AnalysisCountEquation>,
    ): Set<String> {
        val connected = seeds.toMutableSet()
        var changed: Boolean
        do {
            changed = false
            equations.forEach { equation ->
                val participants = setOf(equation.totalId) + equation.componentIds
                if (participants.any { it in connected } && connected.addAll(participants)) changed = true
            }
        } while (changed)
        return connected
    }
}

private fun exactRank(coefficients: List<List<Int>>): Int {
    if (coefficients.isEmpty() || coefficients.first().isEmpty()) return 0
    val matrix = coefficients.map { row -> row.map(ExactFraction::of).toMutableList() }.toMutableList()
    val columnCount = matrix.first().size
    var pivotRow = 0

    for (column in 0 until columnCount) {
        val candidate = (pivotRow until matrix.size).firstOrNull { !matrix[it][column].isZero } ?: continue
        if (candidate != pivotRow) {
            val swapped = matrix[pivotRow]
            matrix[pivotRow] = matrix[candidate]
            matrix[candidate] = swapped
        }

        val pivot = matrix[pivotRow][column]
        for (row in pivotRow + 1 until matrix.size) {
            if (matrix[row][column].isZero) continue
            val factor = matrix[row][column] / pivot
            for (nextColumn in column until columnCount) {
                matrix[row][nextColumn] = matrix[row][nextColumn] - factor * matrix[pivotRow][nextColumn]
            }
        }
        pivotRow += 1
        if (pivotRow == matrix.size) break
    }
    return pivotRow
}

private class ExactFraction private constructor(
    val numerator: BigInteger,
    val denominator: BigInteger,
) {
    val isZero: Boolean get() = numerator == BigInteger.ZERO

    operator fun minus(other: ExactFraction): ExactFraction = of(
        numerator * other.denominator - other.numerator * denominator,
        denominator * other.denominator,
    )

    operator fun times(other: ExactFraction): ExactFraction = of(
        numerator * other.numerator,
        denominator * other.denominator,
    )

    operator fun div(other: ExactFraction): ExactFraction {
        require(!other.isZero) { "Cannot divide by zero" }
        return of(numerator * other.denominator, denominator * other.numerator)
    }

    companion object {
        fun of(value: Int): ExactFraction = ExactFraction(BigInteger.valueOf(value.toLong()), BigInteger.ONE)

        private fun of(numerator: BigInteger, denominator: BigInteger): ExactFraction {
            if (numerator == BigInteger.ZERO) return ExactFraction(BigInteger.ZERO, BigInteger.ONE)
            val sign = if (denominator.signum() < 0) BigInteger.valueOf(-1) else BigInteger.ONE
            val signedNumerator = numerator * sign
            val positiveDenominator = denominator * sign
            val divisor = signedNumerator.abs().gcd(positiveDenominator)
            return ExactFraction(signedNumerator / divisor, positiveDenominator / divisor)
        }
    }
}
