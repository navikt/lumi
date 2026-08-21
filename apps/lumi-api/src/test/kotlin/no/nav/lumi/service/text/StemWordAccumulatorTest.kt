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

    test("falls back to stem when no occurrences") {
        val acc = StemWordAccumulator("orphan")
        acc.getCanonicalForm() shouldBe "orphan"
    }
})
