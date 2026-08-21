package no.nav.lumi.routes

import io.kotest.assertions.throwables.shouldNotThrow
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.domain.PhraseFilter

class QueryValidationTest : FunSpec({

    context("parseChoiceFilters") {
        test("parses valid choice filters") {
            val result = parseChoiceFilters(
                choice = listOf("role:Arbeidsgiver", "category:Leder"),
                legacyFieldId = null,
                legacyValue = null,
            )
            result shouldBe listOf("role" to "Arbeidsgiver", "category" to "Leder")
        }

        test("merges legacy params") {
            val result = parseChoiceFilters(
                choice = listOf("role:Arbeidsgiver"),
                legacyFieldId = "category",
                legacyValue = "Leder",
            )
            result shouldBe listOf("role" to "Arbeidsgiver", "category" to "Leder")
        }

        test("returns empty list for null input") {
            val result = parseChoiceFilters(null, null, null)
            result shouldBe emptyList()
        }

        test("rejects missing colon separator") {
            val ex = shouldThrow<ApiErrorException.BadRequestException> {
                parseChoiceFilters(listOf("roleArbeidsgiver"), null, null)
            }
            ex.message shouldContain "expected format"
        }

        test("rejects blank fieldId") {
            val ex = shouldThrow<ApiErrorException.BadRequestException> {
                parseChoiceFilters(listOf(":value"), null, null)
            }
            ex.message shouldContain "expected format"
        }

        test("rejects blank value") {
            val ex = shouldThrow<ApiErrorException.BadRequestException> {
                parseChoiceFilters(listOf("field: "), null, null)
            }
            ex.message shouldContain "non-blank"
        }

        test("rejects value exceeding max length") {
            val longValue = "a".repeat(201)
            val ex = shouldThrow<ApiErrorException.BadRequestException> {
                parseChoiceFilters(listOf("field:$longValue"), null, null)
            }
            ex.message shouldContain "max length"
        }

        test("rejects fieldId with illegal characters") {
            val ex = shouldThrow<ApiErrorException.BadRequestException> {
                parseChoiceFilters(listOf("field\$id:value"), null, null)
            }
            ex.message shouldContain "illegal characters"
        }

        test("rejects value with JSON path special characters") {
            val ex = shouldThrow<ApiErrorException.BadRequestException> {
                parseChoiceFilters(listOf("field:value\"with\"quotes"), null, null)
            }
            ex.message shouldContain "illegal characters"
        }

        test("rejects legacy value with JSON path special characters") {
            val ex = shouldThrow<ApiErrorException.BadRequestException> {
                parseChoiceFilters(null, "field", "value\$injected")
            }
            ex.message shouldContain "illegal characters"
        }

        test("rejects too many filters") {
            val filters = (1..21).map { "field$it:value$it" }
            val ex = shouldThrow<ApiErrorException.BadRequestException> {
                parseChoiceFilters(filters, null, null)
            }
            ex.message shouldContain "Too many"
        }
    }

    context("parseRatingFilters") {
        test("parses valid rating filters") {
            val result = parseRatingFilters(
                rating = listOf("satisfaction:5", "nps:9"),
                legacyFieldId = null,
                legacyValue = null,
            )
            result shouldBe listOf("satisfaction" to 5, "nps" to 9)
        }

        test("merges legacy params") {
            val result = parseRatingFilters(
                rating = null,
                legacyFieldId = "satisfaction",
                legacyValue = 3,
            )
            result shouldBe listOf("satisfaction" to 3)
        }

        test("returns empty list for null input") {
            val result = parseRatingFilters(null, null, null)
            result shouldBe emptyList()
        }

        test("rejects non-integer value") {
            val ex = shouldThrow<ApiErrorException.BadRequestException> {
                parseRatingFilters(listOf("field:abc"), null, null)
            }
            ex.message shouldContain "integer"
        }

        test("rejects missing colon separator") {
            val ex = shouldThrow<ApiErrorException.BadRequestException> {
                parseRatingFilters(listOf("field5"), null, null)
            }
            ex.message shouldContain "expected format"
        }

        test("rejects fieldId with illegal characters") {
            val ex = shouldThrow<ApiErrorException.BadRequestException> {
                parseRatingFilters(listOf("field@id:5"), null, null)
            }
            ex.message shouldContain "illegal characters"
        }

        test("rejects too many filters") {
            val filters = (1..21).map { "field$it:$it" }
            val ex = shouldThrow<ApiErrorException.BadRequestException> {
                parseRatingFilters(filters, null, null)
            }
            ex.message shouldContain "Too many"
        }
    }

    context("parsePhraseFilter") {
        test("parses valid phrase filter") {
            val result = parsePhraseFilter(listOf("fieldId:vanskelig svare"))

            result shouldBe PhraseFilter(fieldId = "fieldId", surface = "vanskelig svare")
        }

        test("accepts natural display text and normalizes it to two content words") {
            val result = parsePhraseFilter(listOf("fieldId:vanskelig å svare"))

            result shouldBe PhraseFilter(fieldId = "fieldId", surface = "vanskelig svare")
        }

        test("returns null for null input") {
            parsePhraseFilter(null) shouldBe null
        }

        test("returns null for empty input") {
            parsePhraseFilter(emptyList()) shouldBe null
        }

        test("rejects missing colon separator") {
            val rawInput = "fieldId vanskelig svare"
            val ex = shouldThrow<ApiErrorException.BadRequestException> {
                parsePhraseFilter(listOf(rawInput))
            }

            ex.message shouldContain "Invalid phrase format"
            ex.message.shouldNotContain(rawInput)
        }

        test("rejects an extra colon in the phrase surface") {
            shouldThrow<ApiErrorException.BadRequestException> {
                parsePhraseFilter(listOf("fieldId:vanskelig:svare"))
            }
        }

        test("rejects punctuation as an implicit word separator") {
            listOf(
                "fieldId:vanskelig/svare",
                "fieldId:vanskelig,svare",
                "fieldId:vanskelig-svare",
            ).forEach { rawInput ->
                shouldThrow<ApiErrorException.BadRequestException> {
                    parsePhraseFilter(listOf(rawInput))
                }
            }
        }

        test("rejects blank surface after normalization") {
            val rawInput = "fieldId:!!!"
            val ex = shouldThrow<ApiErrorException.BadRequestException> {
                parsePhraseFilter(listOf(rawInput))
            }

            ex.message shouldContain "Invalid phrase format"
            ex.message.shouldNotContain(rawInput)
        }

        test("rejects phrase with only stopwords") {
            val rawInput = "fieldId:og en"
            val ex = shouldThrow<ApiErrorException.BadRequestException> {
                parsePhraseFilter(listOf(rawInput))
            }

            ex.message shouldContain "Invalid phrase format"
            ex.message.shouldNotContain(rawInput)
        }

        test("rejects phrase with more than two content words") {
            val rawInput = "fieldId:vanskelig svare spørsmål"
            val ex = shouldThrow<ApiErrorException.BadRequestException> {
                parsePhraseFilter(listOf(rawInput))
            }

            ex.message shouldContain "Invalid phrase format"
            ex.message.shouldNotContain(rawInput)
        }

        test("rejects invalid fieldId") {
            val rawInput = "field\$id:vanskelig svare"
            val ex = shouldThrow<ApiErrorException.BadRequestException> {
                parsePhraseFilter(listOf(rawInput))
            }

            ex.message shouldContain "Invalid phrase format"
            ex.message.shouldNotContain(rawInput)
        }

        test("rejects more than one phrase filter") {
            val ex = shouldThrow<ApiErrorException.BadRequestException> {
                parsePhraseFilter(listOf("fieldId:vanskelig svare", "fieldId:enkelt svar"))
            }

            ex.message shouldContain "Only a single phrase filter is supported"
        }
    }

    context("validateDateRange") {
        test("accepts valid date range") {
            shouldNotThrow<Exception> {
                validateDateRange("2024-01-01", "2024-12-31")
            }
        }

        test("accepts null dates") {
            shouldNotThrow<Exception> {
                validateDateRange(null, null)
            }
        }

        test("rejects fromDate after toDate") {
            val ex = shouldThrow<ApiErrorException.BadRequestException> {
                validateDateRange("2024-12-31", "2024-01-01")
            }
            ex.message shouldContain "fromDate"
        }

        test("rejects invalid date format") {
            val ex = shouldThrow<ApiErrorException.BadRequestException> {
                validateDateRange("not-a-date", "2024-01-01")
            }
            ex.message shouldContain "YYYY-MM-DD"
        }
    }

    context("toStatsQuery") {
        test("normalizes blank date parameters to a missing period") {
            val query = ApiV1Intern.Stats(
                fromDate = "",
                toDate = "   ",
            ).toStatsQuery(team = "flex")

            query.fromDate shouldBe null
            query.toDate shouldBe null
        }
    }
})
