package no.nav.lumi.service.text

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe

class QuoteSelectorTest : FunSpec({

    context("selectQuotes") {
        test("filters by length (30-300 chars)") {
            val candidates = listOf(
                "Short" to "2024-01-01T00:00:00Z",
                "This is a quote that is long enough to pass the filter" to "2024-01-02T00:00:00Z",
                "x".repeat(301) to "2024-01-03T00:00:00Z",
            )
            val quotes = QuoteSelector.selectQuotes(candidates, seed = 42L)
            quotes shouldHaveSize 1
            quotes[0].text shouldBe "This is a quote that is long enough to pass the filter"
        }

        test("returns empty for no eligible candidates") {
            val candidates = listOf("Too short" to "2024-01-01T00:00:00Z")
            QuoteSelector.selectQuotes(candidates, seed = 42L).shouldBeEmpty()
        }

        test("deterministic with same seed") {
            val candidates = (1..20).map {
                "Quote number $it with enough length to pass filter" to "2024-01-${it.toString().padStart(2, '0')}T00:00:00Z"
            }
            val first = QuoteSelector.selectQuotes(candidates, seed = 123L)
            val second = QuoteSelector.selectQuotes(candidates, seed = 123L)
            first shouldBe second
        }

        test("respects targetCount") {
            val candidates = (1..20).map {
                "Quote number $it with enough length to pass filter" to "2024-01-${it.toString().padStart(2, '0')}T00:00:00Z"
            }
            val quotes = QuoteSelector.selectQuotes(candidates, targetCount = 3, seed = 42L)
            quotes shouldHaveSize 3
        }
    }

    context("confidenceLevel") {
        test("low for fewer than 30 responses") {
            QuoteSelector.confidenceLevel(0) shouldBe "low"
            QuoteSelector.confidenceLevel(29) shouldBe "low"
        }

        test("medium for 30-100 responses") {
            QuoteSelector.confidenceLevel(30) shouldBe "medium"
            QuoteSelector.confidenceLevel(100) shouldBe "medium"
        }

        test("high for more than 100 responses") {
            QuoteSelector.confidenceLevel(101) shouldBe "high"
            QuoteSelector.confidenceLevel(1000) shouldBe "high"
        }
    }
})
