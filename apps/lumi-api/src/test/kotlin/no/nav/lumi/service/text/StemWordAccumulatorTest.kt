package no.nav.lumi.service.text

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe

class StemWordAccumulatorTest : FunSpec({

    test("tracks total count across surface forms") {
        val acc = StemWordAccumulator("søknad")
        acc.addOccurrence("søknad")
        acc.addOccurrence("søknaden")
        acc.addOccurrence("søknad")

        acc.totalCount shouldBe 3
    }

    test("canonical form is the most common surface form") {
        val acc = StemWordAccumulator("søknad")
        acc.addOccurrence("søknaden")
        acc.addOccurrence("søknad")
        acc.addOccurrence("søknad")
        acc.addOccurrence("søknadene")

        acc.getCanonicalForm() shouldBe "søknad"
    }

    test("canonical form breaks ties alphabetically") {
        val acc = StemWordAccumulator("test")
        acc.addOccurrence("beta")
        acc.addOccurrence("alpha")

        acc.getCanonicalForm() shouldBe "alpha"
    }

    test("variants are sorted by count desc, then alphabetically") {
        val acc = StemWordAccumulator("søknad")
        acc.addOccurrence("søknad")
        acc.addOccurrence("søknad")
        acc.addOccurrence("søknaden")
        acc.addOccurrence("søknadene")

        val variants = acc.getVariants()
        variants[0].word shouldBe "søknad"
        variants[0].count shouldBe 2
        variants[1].word shouldBe "søknaden"
        variants[1].count shouldBe 1
    }

    test("respects custom maxVariants") {
        val acc = StemWordAccumulator("test", maxVariants = 2)
        acc.addOccurrence("a")
        acc.addOccurrence("b")
        acc.addOccurrence("c")

        acc.getVariants().size shouldBe 2
    }

    test("toWordFrequencyEntry includes all fields") {
        val acc = StemWordAccumulator("søknad")
        acc.addOccurrence("søknad")
        acc.addOccurrence("søknad")
        acc.addOccurrence("søknaden")

        val entry = acc.toWordFrequencyEntry()
        entry.word shouldBe "søknad"
        entry.stem shouldBe "søknad"
        entry.count shouldBe 3
        entry.variants.size shouldBe 2
    }

    test("falls back to stem when no occurrences") {
        val acc = StemWordAccumulator("orphan")
        acc.getCanonicalForm() shouldBe "orphan"
    }
})
