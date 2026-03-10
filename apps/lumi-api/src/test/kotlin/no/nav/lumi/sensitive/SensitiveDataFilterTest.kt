package no.nav.lumi.sensitive

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain

class SensitiveDataFilterTest : FunSpec({

    val filter = SensitiveDataFilter.DEFAULT

    // 01020349294 is a MOD11-valid fødselsnummer used throughout these tests.
    val validFnr = "01020349294"

    context("Fødselsnummer detection") {
        test("should detect valid fødselsnummer (MOD11 passes)") {
            val text = "Min fødselsnummer er $validFnr"
            val matches = filter.detect(text)

            // 11 consecutive digits also matches kontonummer pattern (4+2+5 digits)
            matches.size shouldBe 2
            matches.any { it.patternName == "fødselsnummer" && it.matchedValue == validFnr } shouldBe true
        }

        test("should redact valid fødselsnummer") {
            val text = "Bruker $validFnr har sendt inn søknad"
            val result = filter.redact(text)

            result.redactedText shouldNotContain validFnr
            result.wasRedacted shouldBe true
        }

        test("should detect fødselsnummer with space separator") {
            val text = "Mitt fnr er 010203 49294"
            val matches = filter.detect(text)

            matches.any { it.patternName == "fødselsnummer" && it.matchedValue == "010203 49294" } shouldBe true
        }

        test("should redact fødselsnummer with space separator") {
            val result = filter.redact("Bruker 010203 49294 har søkt")

            result.redactedText shouldNotContain "010203 49294"
            result.redactedText shouldContain "[FØDSELSNUMMER FJERNET]"
            result.wasRedacted shouldBe true
        }

        test("should detect fødselsnummer with dash separator") {
            val text = "Mitt fnr er 010203-49294"
            val matches = filter.detect(text)

            matches.any { it.patternName == "fødselsnummer" && it.matchedValue == "010203-49294" } shouldBe true
        }

        test("should redact fødselsnummer with dash separator") {
            val result = filter.redact("ID: 010203-49294 er registrert")

            result.redactedText shouldNotContain "010203-49294"
            result.redactedText shouldContain "[FØDSELSNUMMER FJERNET]"
            result.wasRedacted shouldBe true
        }

        test("should not flag sequence that fails MOD11 as fødselsnummer") {
            // 12345678901 does not pass MOD11 check digits → must not be reported as fødselsnummer.
            // It may still match the kontonummer pattern.
            val matches = filter.detect("12345678901")

            matches.none { it.patternName == "fødselsnummer" } shouldBe true
        }
    }

    context("NAVident detection") {
        test("should detect NAVident") {
            val text = "Saksbehandler A123456 har behandlet saken"
            val matches = filter.detect(text)

            matches.size shouldBe 1
            matches[0].patternName shouldBe "navident"
        }

        test("should redact NAVident") {
            val result = filter.redact("Kontakt Z999999 for hjelp")

            result.redactedText shouldContain "[NAVIDENT FJERNET]"
            result.wasRedacted shouldBe true
        }

        test("should not flag regular words as NAVident") {
            val matches = filter.detect("Det er ingen ident her")

            matches.none { it.patternName == "navident" } shouldBe true
        }
    }

    context("Email detection") {
        test("should detect email addresses") {
            val text = "Send mail til test.bruker@nav.no for mer info"
            val matches = filter.detect(text)

            matches.size shouldBe 1
            matches[0].patternName shouldBe "e-post"
            matches[0].matchedValue shouldBe "test.bruker@nav.no"
        }

        test("should detect multiple emails") {
            val text = "Kontakt ola@gmail.com eller kari@hotmail.com"
            val matches = filter.detect(text)

            matches.size shouldBe 2
        }

        test("should redact email address") {
            val result = filter.redact("Min epost er bruker@example.com takk")

            result.redactedText shouldNotContain "bruker@example.com"
            result.redactedText shouldContain "[E-POST FJERNET]"
            result.wasRedacted shouldBe true
        }
    }

    context("Phone number detection") {
        test("should detect 8-digit phone number without separators") {
            val text = "Ring meg på 98765432"
            val matches = filter.detect(text)

            matches.size shouldBe 1
            matches[0].patternName shouldBe "telefonnummer"
        }

        test("should detect phone number with spaces (XXX XX XXX format)") {
            val text = "Ring 987 65 432"
            val matches = filter.detect(text)

            matches.any { it.patternName == "telefonnummer" && it.matchedValue == "987 65 432" } shouldBe true
        }

        test("should detect phone number with dashes (XXX-XX-XXX format)") {
            val text = "Ring 987-65-432"
            val matches = filter.detect(text)

            matches.any { it.patternName == "telefonnummer" && it.matchedValue == "987-65-432" } shouldBe true
        }

        test("should detect phone number with spaces (XXXX XXXX format)") {
            val text = "Ring 9876 5432"
            val matches = filter.detect(text)

            matches.any { it.patternName == "telefonnummer" && it.matchedValue == "9876 5432" } shouldBe true
        }

        test("should detect phone number with spaces (XX XX XX XX format)") {
            val text = "Tlf: 98 76 54 32"
            val matches = filter.detect(text)

            matches.any { it.patternName == "telefonnummer" && it.matchedValue == "98 76 54 32" } shouldBe true
        }

        test("should redact phone number with separators") {
            val result = filter.redact("Ring 987 65 432 for hjelp")

            result.redactedText shouldNotContain "987 65 432"
            result.redactedText shouldContain "[TELEFON FJERNET]"
            result.wasRedacted shouldBe true
        }

        test("should not match UUIDs or hex strings") {
            val text = "ID: a1234567-89ab-cdef-0123-456789abcdef"
            val matches = filter.detect(text)

            matches.none { it.patternName == "telefonnummer" } shouldBe true
        }
    }

    context("Bank account detection") {
        test("should detect bank account with dots") {
            val text = "Overfør til konto 1234.56.12345"
            val matches = filter.detect(text)

            matches.any { it.patternName == "kontonummer" } shouldBe true
        }

        test("should detect bank account without dots") {
            val text = "Kontonummer: 12345612345"
            val matches = filter.detect(text)

            matches.any { it.patternName == "kontonummer" || it.patternName == "fødselsnummer" } shouldBe true
        }

        test("should redact bank account number") {
            val result = filter.redact("Send penger til 1234.56.12345 snarest")

            result.redactedText shouldNotContain "1234.56.12345"
            result.redactedText shouldContain "[KONTONUMMER FJERNET]"
            result.wasRedacted shouldBe true
        }
    }

    context("IP address detection") {
        test("should detect IPv4 address") {
            val strictFilter = SensitiveDataFilter.STRICT
            val text = "Server IP er 192.168.1.100"
            val matches = strictFilter.detect(text)

            matches.any { it.patternName == "ip-adresse" && it.matchedValue == "192.168.1.100" } shouldBe true
        }

        test("should redact IPv4 address") {
            val strictFilter = SensitiveDataFilter.STRICT
            val result = strictFilter.redact("Logget inn fra 10.0.0.1")

            result.redactedText shouldNotContain "10.0.0.1"
            result.redactedText shouldContain "[IP-ADRESSE FJERNET]"
            result.wasRedacted shouldBe true
        }
    }

    context("Bank card detection") {
        test("should detect credit card number without separators") {
            val text = "Kortnummer: 1234567890123456"
            val matches = filter.detect(text)

            matches.any { it.patternName == "bankkort" } shouldBe true
        }

        test("should detect credit card number with spaces") {
            val text = "Kortnummer: 1234 5678 9012 3456"
            val matches = filter.detect(text)

            matches.any { it.patternName == "bankkort" } shouldBe true
        }

        test("should detect credit card number with dashes") {
            val text = "Kortnummer: 1234-5678-9012-3456"
            val matches = filter.detect(text)

            matches.any { it.patternName == "bankkort" } shouldBe true
        }

        test("should redact bank card number") {
            val result = filter.redact("Kortet mitt er 1234-5678-9012-3456")

            result.redactedText shouldNotContain "1234-5678-9012-3456"
            result.redactedText shouldContain "[KORTNUMMER FJERNET]"
            result.wasRedacted shouldBe true
        }
    }

    context("Secret address detection") {
        test("should detect hemmelig adresse") {
            val text = "Brukeren har hemmelig adresse"
            val matches = filter.detect(text)

            matches.any { it.patternName == "hemmelig_adresse" } shouldBe true
        }

        test("should detect hemmelig adresse case-insensitively") {
            val text = "HEMMELIG ADRESSE er registrert"
            val matches = filter.detect(text)

            matches.any { it.patternName == "hemmelig_adresse" } shouldBe true
        }

        test("should redact hemmelig adresse") {
            val result = filter.redact("Har hemmelig adresse på grunn av sikkerhet")

            result.redactedText shouldNotContain "hemmelig adresse"
            result.redactedText shouldContain "[HEMMELIG ADRESSE]"
            result.wasRedacted shouldBe true
        }
    }

    context("Multiple patterns") {
        test("should detect multiple different patterns") {
            val text = "Bruker $validFnr (test@nav.no) ringte 98765432"
            val result = filter.redact(text)

            // validFnr matches both fødselsnummer and kontonummer patterns
            result.matchCount shouldBe 4
            result.matchedPatterns shouldContainExactlyInAnyOrder setOf("fødselsnummer", "kontonummer", "e-post", "telefonnummer")
            result.redactedText shouldNotContain validFnr
            result.redactedText shouldNotContain "test@nav.no"
            result.redactedText shouldNotContain "98765432"
        }

        test("should not corrupt redacted output when patterns overlap on same 11-digit substring") {
            // validFnr overlaps fødselsnummer (\b\d{6}[\s-]?\d{5}\b) and kontonummer patterns.
            val text = "Tekst med tall $validFnr i midten"

            val result = filter.redact(text)

            result.wasRedacted shouldBe true
            result.redactedText shouldNotContain validFnr

            // Ensure we don't get double-replacement artifacts like "...FJERNET]MER FJERNET]".
            result.redactedText shouldNotContain "]MER FJERNET]"

            // Fødselsnummer has higher priority than kontonummer.
            result.redactedText shouldContain "[FØDSELSNUMMER FJERNET]"
            result.redactedText shouldNotContain "[KONTONUMMER FJERNET]"
        }
    }

    context("No sensitive data") {
        test("should not modify text without sensitive data") {
            val text = "Dette er en vanlig tilbakemelding uten sensitiv info"
            val result = filter.redact(text)

            result.wasRedacted shouldBe false
            result.redactedText shouldBe text
            result.matchCount shouldBe 0
        }
    }

    context("Empty or null input") {
        test("should handle null input") {
            val result = filter.redact(null)

            result.wasRedacted shouldBe false
            result.redactedText shouldBe ""
        }

        test("should handle empty string") {
            val result = filter.redact("")

            result.wasRedacted shouldBe false
            result.redactedText shouldBe ""
        }
    }

    context("Map redaction") {
        test("should redact values in a map") {
            val data = mapOf(
                "name" to "Ola Nordmann",
                "email" to "ola@nav.no",
                "feedback" to "Bruker $validFnr hadde problemer"
            )

            val (redacted, matches) = filter.redactMap(data)

            (redacted["email"] as String) shouldContain "[E-POST FJERNET]"
            // Feedback value is redacted (fødselsnummer or kontonummer pattern matched)
            (redacted["feedback"] as String) shouldNotContain validFnr
            // validFnr matches both fødselsnummer and kontonummer patterns
            matches.size shouldBe 3
        }
    }
})
