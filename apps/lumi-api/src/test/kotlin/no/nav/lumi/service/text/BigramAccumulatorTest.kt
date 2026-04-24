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

    test("empty accumulator returns stemKey as canonical") {
        val acc = BigramAccumulator("foo|bar")
        acc.getCanonicalSurface() shouldBe "foo|bar"
    }
})
