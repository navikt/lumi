package no.nav.lumi.domain

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe

class AnalysisSuppressionPolicyTest : FunSpec({
    val policy = AnalysisSuppressionPolicyV1()

    test("shows zero and counts from five while hiding one through four") {
        val result = policy.apply(
            cells = listOf(
                AnalysisCountCell("zero", 0),
                AnalysisCountCell("one", 1),
                AnalysisCountCell("four", 4),
                AnalysisCountCell("five", 5),
            ),
        ).associateBy { it.id }

        result.getValue("zero") shouldBe AnalysisPublishedCountCell("zero", 0, AnalysisCountStatus.EXACT)
        result.getValue("one") shouldBe AnalysisPublishedCountCell("one", null, AnalysisCountStatus.BELOW_THRESHOLD)
        result.getValue("four") shouldBe AnalysisPublishedCountCell("four", null, AnalysisCountStatus.BELOW_THRESHOLD)
        result.getValue("five") shouldBe AnalysisPublishedCountCell("five", 5, AnalysisCountStatus.EXACT)
    }

    test("secondary suppression prevents reconstructing a 6 5 1 complement") {
        val result = policy.apply(
            cells = listOf(
                AnalysisCountCell("total", 6),
                AnalysisCountCell("selected", 5),
                AnalysisCountCell("complement", 1),
            ),
            equations = listOf(AnalysisCountEquation("total", setOf("selected", "complement"))),
        ).associateBy { it.id }

        result.getValue("total").value shouldBe 6
        result.getValue("selected").status shouldBe AnalysisCountStatus.BELOW_THRESHOLD
        result.getValue("complement").status shouldBe AnalysisCountStatus.BELOW_THRESHOLD
    }

    test("is order invariant idempotent and uses one external suppression status") {
        val cells = listOf(
            AnalysisCountCell("total", 10),
            AnalysisCountCell("large", 7),
            AnalysisCountCell("small", 3),
            AnalysisCountCell("other", 0),
        )
        val equations = listOf(AnalysisCountEquation("total", setOf("large", "small")))

        val first = policy.apply(cells, equations)
        val permuted = policy.apply(cells.reversed(), equations.reversed())

        first shouldBe permuted
        first.single { it.id == "large" }.status shouldBe AnalysisCountStatus.BELOW_THRESHOLD
        first.single { it.id == "small" }.status shouldBe AnalysisCountStatus.BELOW_THRESHOLD
        first.map { it.status }.toSet() shouldBe setOf(AnalysisCountStatus.EXACT, AnalysisCountStatus.BELOW_THRESHOLD)
    }

    test("two already hidden components do not require hiding the total") {
        val result = policy.apply(
            cells = listOf(
                AnalysisCountCell("total", 5),
                AnalysisCountCell("a", 3),
                AnalysisCountCell("b", 2),
            ),
            equations = listOf(AnalysisCountEquation("total", setOf("a", "b"))),
        ).associateBy { it.id }

        result.getValue("total").status shouldBe AnalysisCountStatus.EXACT
        result.getValue("a").status shouldBe AnalysisCountStatus.BELOW_THRESHOLD
        result.getValue("b").status shouldBe AnalysisCountStatus.BELOW_THRESHOLD
    }

    test("secondary suppression protects overlapping equations as one system") {
        val result = policy.apply(
            cells = listOf(
                AnalysisCountCell("a", 3),
                AnalysisCountCell("b", 3),
                AnalysisCountCell("c", 3),
                AnalysisCountCell("ab", 6),
                AnalysisCountCell("ac", 6),
                AnalysisCountCell("bc", 6),
            ),
            equations = listOf(
                AnalysisCountEquation("ab", setOf("a", "b")),
                AnalysisCountEquation("ac", setOf("a", "c")),
                AnalysisCountEquation("bc", setOf("b", "c")),
            ),
        ).associateBy { it.id }

        result.getValue("a").status shouldBe AnalysisCountStatus.BELOW_THRESHOLD
        result.getValue("b").status shouldBe AnalysisCountStatus.BELOW_THRESHOLD
        result.getValue("c").status shouldBe AnalysisCountStatus.BELOW_THRESHOLD
        result.values.count { it.id in setOf("ab", "ac", "bc") && it.value == null } shouldBe 1
    }
})
