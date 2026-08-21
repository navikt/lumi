package no.nav.lumi.service.text

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe

class BigramAccumulatorTest : FunSpec({

    test("counts unique responses, not total occurrences") {
        val acc = BigramAccumulator("dårlig|design")
        acc.addOccurrence("dårlig design", "r1")
        acc.addOccurrence("dårlig design", "r1")
        acc.totalCount shouldBe 1
    }

    test("counts distinct responses") {
        val acc = BigramAccumulator("dårlig|design")
        acc.addOccurrence("dårlig design", "r1")
        acc.addOccurrence("dårlig design", "r2")
        acc.addOccurrence("dårlige design", "r3")
        acc.totalCount shouldBe 3
    }

    test("canonical surface is most common form") {
        val acc = BigramAccumulator("dårlig|design")
        acc.addOccurrence("dårlig design", "r1")
        acc.addOccurrence("dårlig design", "r2")
        acc.addOccurrence("dårlige design", "r3")
        acc.getCanonicalSurface() shouldBe "dårlig design"
    }

    test("canonical surface tiebreaks alphabetically") {
        val acc = BigramAccumulator("test|key")
        acc.addOccurrence("beta form", "r1")
        acc.addOccurrence("alpha form", "r2")
        acc.getCanonicalSurface() shouldBe "alpha form"
    }

    test("toPhraseEntry respects maxSourceIds") {
        val acc = BigramAccumulator("test|key")
        repeat(10) { acc.addOccurrence("test phrase", "r$it") }
        val entry = acc.toPhraseEntry(maxSourceIds = 3)
        entry.sourceResponseIds shouldHaveSize 3
        entry.count shouldBe 10
    }

    test("caps internal sourceResponseIds at default max") {
        val acc = BigramAccumulator("test|key")
        repeat(20) { acc.addOccurrence("test phrase", "r$it") }
        // Internal list capped at DEFAULT_MAX_SOURCE_IDS (5), but count tracks all
        val entry = acc.toPhraseEntry()
        entry.sourceResponseIds shouldHaveSize BigramAccumulator.DEFAULT_MAX_SOURCE_IDS
        entry.count shouldBe 20
    }

    test("empty accumulator returns stemKey as canonical") {
        val acc = BigramAccumulator("foo|bar")
        acc.getCanonicalSurface() shouldBe "foo|bar"
    }

    test("selectDiverse collapses word chains but keeps unrelated findings from the same responses") {
        val first = BigramAccumulator("endring|min")
        val second = BigramAccumulator("min|lagr")
        val chainStart = BigramAccumulator("usikker|endring")
        val distinct = BigramAccumulator("kontakt|nav")
        repeat(10) { index ->
            first.addOccurrence("endringene mine", "same-$index")
            second.addOccurrence("mine ble lagret", "same-$index")
            chainStart.addOccurrence("usikker på endringene", "same-$index")
            distinct.addOccurrence("kontakte nav", "same-$index")
            first.addAdjacentWindow(chainStart.stemKey, "same-$index")
            second.addAdjacentWindow(first.stemKey, "same-$index")
        }

        BigramAccumulator.selectDiverse(
            accumulators = listOf(first, second, chainStart, distinct),
            minimumOccurrences = 2,
            maximumPhrases = 10,
        ).map { it.stemKey } shouldBe listOf("endring|min", "kontakt|nav")
    }

    test("keeps separate sentences that share a common word") {
        val sent = BigramAccumulator("søknad|sendt")
        val missing = BigramAccumulator("søknad|mangl")
        repeat(5) { index ->
            sent.addOccurrence("søknaden sendt", "same-$index")
            missing.addOccurrence("søknaden mangler", "same-$index")
        }

        BigramAccumulator.selectDiverse(
            accumulators = listOf(sent, missing),
            minimumOccurrences = 2,
            maximumPhrases = 10,
        ).map { it.stemKey } shouldBe listOf("søknad|mangl", "søknad|sendt")
    }
})
