package no.nav.lumi.sensitive

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe

class HtmlSanitizerTest : FunSpec({
    val sanitizer = HtmlSanitizer.DEFAULT

    test("should strip html tags") {
        val input = "<script>alert('xss')</script>Hei <b>verden</b>"

        sanitizer.stripTags(input) shouldBe "alert('xss')Hei verden"
    }

    test("should keep plain text unchanged") {
        val input = "Bare vanlig tekst"

        sanitizer.stripTags(input) shouldBe input
    }

    test("should return empty string for null") {
        sanitizer.stripTags(null) shouldBe ""
    }
})
