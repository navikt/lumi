package no.nav.lumi.sensitive

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe

class UrlRedactorTest : FunSpec({

    val redactor = UrlRedactor()

    context("URL query parameter redaction") {
        test("URL without query params is unchanged") {
            val result = redactor.redactUrl("https://nav.no/arbeid")
            result.redactedUrl shouldBe "https://nav.no/arbeid"
            result.wasRedacted shouldBe false
        }

        test("redacts fødselsnummer in query param value") {
            val result = redactor.redactUrl("https://nav.no/sok?soek=01020349294")
            result.redactedUrl shouldBe "https://nav.no/sok?soek=%5BF%C3%98DSELSNUMMER+FJERNET%5D"
            result.wasRedacted shouldBe true
        }

        test("redacts only param with PII, leaves others intact") {
            val result = redactor.redactUrl("https://nav.no/sok?a=ok&b=01020349294&c=test")
            result.redactedUrl shouldBe "https://nav.no/sok?a=ok&b=%5BF%C3%98DSELSNUMMER+FJERNET%5D&c=test"
            result.wasRedacted shouldBe true
        }

        test("redacts email in query param") {
            val result = redactor.redactUrl("https://nav.no/finn?email=ola.nordmann@nav.no")
            result.redactedUrl shouldBe "https://nav.no/finn?email=%5BE-POST+FJERNET%5D"
            result.wasRedacted shouldBe true
        }

        test("preserves clean fragment") {
            val result = redactor.redactUrl("https://nav.no/sok?q=01020349294#section")
            result.redactedUrl shouldBe "https://nav.no/sok?q=%5BF%C3%98DSELSNUMMER+FJERNET%5D#section"
            result.wasRedacted shouldBe true
        }

        test("redacts PII in fragment") {
            val result = redactor.redactUrl("https://nav.no/page#fnr=01020349294")
            result.wasRedacted shouldBe true
            result.redactedUrl shouldBe "https://nav.no/page#fnr=%5BF%C3%98DSELSNUMMER%20FJERNET%5D"
        }

        test("redacts PII in query param key") {
            val result = redactor.redactUrl("https://nav.no/sok?01020349294=value")
            result.wasRedacted shouldBe true
            result.redactedUrl shouldBe "https://nav.no/sok?%5BF%C3%98DSELSNUMMER+FJERNET%5D=value"
        }

        test("redacts bare query token without equals") {
            val result = redactor.redactUrl("https://nav.no/sok?01020349294")
            result.wasRedacted shouldBe true
        }

        test("empty query string is unchanged") {
            val result = redactor.redactUrl("https://nav.no/sok?")
            result.redactedUrl shouldBe "https://nav.no/sok?"
            result.wasRedacted shouldBe false
        }

        test("null input returns empty unchanged") {
            val result = redactor.redactUrl(null)
            result.redactedUrl shouldBe ""
            result.wasRedacted shouldBe false
        }

        test("empty string returns empty unchanged") {
            val result = redactor.redactUrl("")
            result.redactedUrl shouldBe ""
            result.wasRedacted shouldBe false
        }

        test("URL-encoded PII is decoded before redaction") {
            // %30%31%30%32%30%33%34%39%32%39%34 = 01020349294 URL-encoded
            val result = redactor.redactUrl("https://nav.no/sok?q=%30%31%30%32%30%33%34%39%32%39%34")
            result.wasRedacted shouldBe true
            result.redactedUrl shouldBe "https://nav.no/sok?q=%5BF%C3%98DSELSNUMMER+FJERNET%5D"
        }

        test("double URL-encoded PII is caught via iterative decode") {
            // %2530%2531... → %30%31... → 01020349294
            val result = redactor.redactUrl("https://nav.no/sok?q=%2530%2531%2530%2532%2530%2533%2534%2539%2532%2539%2534")
            result.wasRedacted shouldBe true
            result.redactedUrl shouldBe "https://nav.no/sok?q=%5BF%C3%98DSELSNUMMER+FJERNET%5D"
        }

        test("URL-encoded PII in fragment is decoded and redacted") {
            val result = redactor.redactUrl("https://nav.no/page#user=%30%31%30%32%30%33%34%39%32%39%34")
            result.wasRedacted shouldBe true
            result.redactedUrl shouldBe "https://nav.no/page#user=%5BF%C3%98DSELSNUMMER%20FJERNET%5D"
        }

        test("URL-encoded PII in path is decoded and redacted") {
            val result = redactor.redactUrl("https://nav.no/bruker/%30%31%30%32%30%33%34%39%32%39%34/status")
            result.wasRedacted shouldBe true
            result.redactedUrl shouldBe "https://nav.no/bruker/%5BF%C3%98DSELSNUMMER%20FJERNET%5D/status"
        }
    }

    context("PII in URL path (fallback full-string redaction)") {
        test("redacts fødselsnummer in path") {
            val result = redactor.redactUrl("https://nav.no/bruker/01020349294/status")
            result.redactedUrl shouldBe "https://nav.no/bruker/%5BF%C3%98DSELSNUMMER%20FJERNET%5D/status"
            result.wasRedacted shouldBe true
        }

        test("redacts PII in both path and query params") {
            val result = redactor.redactUrl("https://nav.no/bruker/01020349294?email=test@nav.no")
            result.wasRedacted shouldBe true
            // Path PII redacted by full-string pass, query PII by param-level
            result.redactedUrl shouldBe "https://nav.no/bruker/%5BF%C3%98DSELSNUMMER%20FJERNET%5D?email=%5BE-POST+FJERNET%5D"
        }
    }

    context("malformed URLs") {
        test("non-URL string is redacted as plain text") {
            val result = redactor.redactUrl("ring meg på 98765432")
            result.redactedUrl shouldBe "ring meg på [TELEFON FJERNET]"
            result.wasRedacted shouldBe true
        }

        test("relative path without host") {
            val result = redactor.redactUrl("/sok?q=01020349294")
            result.wasRedacted shouldBe true
        }
    }

    context("malformed percent-encoding") {
        test("trailing percent does not abort decode of valid encoded PII") {
            // The trailing % is malformed, but the encoded fnr should still be decoded and caught
            val result = redactor.redactUrl("https://nav.no/sok?q=%30%31%30%32%30%33%34%39%32%39%34%")
            result.wasRedacted shouldBe true
        }

        test("incomplete percent sequence does not abort decode") {
            // %z is not valid hex — should not prevent decoding of the rest
            val result = redactor.redactUrl("https://nav.no/sok?q=%30%31%30%32%30%33%34%39%32%39%34&x=%zz")
            result.wasRedacted shouldBe true
        }

        test("lone percent in path does not prevent PII detection") {
            val result = redactor.redactUrl("https://nav.no/bruker/01020349294/100%")
            result.wasRedacted shouldBe true
        }
    }

    context("plus-sign preservation") {
        test("plus-alias email in query param is redacted") {
            val result = redactor.redactUrl("https://nav.no/sok?email=ola+alias@nav.no")
            result.wasRedacted shouldBe true
        }

        test("percent-encoded plus in email survives multi-pass decode") {
            // %2B should decode to + once and stay there, not degrade to space
            val result = redactor.redactUrl("https://nav.no/sok?email=ola%2Balias@nav.no")
            result.wasRedacted shouldBe true
            result.redactedUrl shouldBe "https://nav.no/sok?email=%5BE-POST+FJERNET%5D"
        }

        test("literal plus in path is preserved when no PII") {
            val result = redactor.redactUrl("https://nav.no/c++/docs")
            result.wasRedacted shouldBe false
            result.redactedUrl shouldBe "https://nav.no/c++/docs"
        }
    }
})
