package no.nav.lumi.domain

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.string.shouldMatch
import io.kotest.matchers.string.shouldNotContain
import java.time.Instant

class BigQueryExportMapperTest : FunSpec({
    val key = ByteArray(32) { it.toByte() }
    val exportedAt = Instant.parse("2026-10-20T02:00:00Z")

    fun mapper(includeFreeText: Boolean = false, pseudonymKey: ByteArray = key) =
        BigQueryExportMapper(pseudonymKey, includeFreeText, exportedAt)

    fun row(
        json: String,
        id: String = "11111111-1111-1111-1111-111111111111",
        receivedAt: Instant = Instant.parse("2026-10-19T22:30:00Z"),
        surveyId: String? = "kartlegging",
        archived: Boolean = false,
    ) = BigQueryExportSourceRow(
        feedbackId = id,
        receivedAt = receivedAt,
        app = "bro-frontend",
        surveyId = surveyId,
        definitionHash = "def123",
        surveyArchived = archived,
        feedbackJson = json,
    )

    fun rating(fieldId: String, value: Int, variant: String, scale: Int, label: String = "Hvordan var det?") = """
        {"fieldId":"$fieldId","fieldType":"RATING","question":{"label":"$label"},
         "value":{"type":"rating","rating":$value,"ratingVariant":"$variant","ratingScale":$scale}}
    """.trimIndent()

    fun submission(vararg answers: String, extra: String = "") = """
        {"schemaVersion":2,"surveyId":"kartlegging","surveyType":"custom",
         "context":{"deviceType":"mobile","tags":{"rolle":"sykmeldt","antall":3,"aktiv":true}},
         "timeToCompleteMs":65400,"answers":[${answers.joinToString(",")}]$extra}
    """.trimIndent()

    test("maps a rating to one svar row with Norwegian date and UTC timestamp") {
        val mapped = mapper().map(row(submission(rating("opplevelse", 4, "emoji", 5)))).shouldNotBeNull()

        mapped.svar shouldHaveSize 1
        val svar = mapped.svar.single()
        svar.sporsmalId shouldBe "opplevelse"
        svar.sporsmalTekst shouldBe "Hvordan var det?"
        svar.sporsmalType shouldBe "RATING"
        svar.ratingVerdi shouldBe 4
        svar.ratingVariant shouldBe "emoji"
        svar.ratingSkala shouldBe 5
        svar.innsendtTidspunkt shouldBe "2026-10-19 22:30:00.000000+00:00"
        svar.innsendtDato shouldBe "2026-10-20"
        svar.enhetstype shouldBe "mobile"
        svar.surveyType shouldBe "custom"
        svar.skjemaversjon shouldBe "def123"
        svar.oppdatertTidspunkt shouldBe "2026-10-20 02:00:00.000000+00:00"
        mapped.innsending.antallSvar shouldBe 1
        mapped.innsending.varighetSekunder shouldBe 65
    }

    test("keeps NPS zero and rejects ratings outside the variant range") {
        val m = mapper()
        val zero = m.map(row(submission(rating("nps", 0, "nps", 11)), id = "a")).shouldNotBeNull()
        zero.svar.single().ratingVerdi shouldBe 0
        zero.svar.single().ratingSkala shouldBe 11

        val tooHigh = m.map(row(submission(rating("stjerner", 6, "stars", 5)), id = "b")).shouldNotBeNull()
        tooHigh.svar.shouldBeEmpty()
        tooHigh.innsending.antallSvar shouldBe 0

        val wrongScale = m.map(row(submission(rating("tommel", 2, "thumbs", 5)), id = "c")).shouldNotBeNull()
        wrongScale.svar.shouldBeEmpty()
        m.skippedAnswers shouldBe 2
    }

    test("gives one row per selected option and uses the newest option label") {
        val m = mapper()
        val newer = submission(
            """
            {"fieldId":"hjelp","fieldType":"MULTI_CHOICE",
             "question":{"label":"Hva hjalp?","options":[{"id":"a","label":"Ny tekst A"},{"id":"b","label":"B"}]},
             "value":{"type":"multiChoice","selectedOptionIds":["a","b","a"]}}
            """.trimIndent(),
        )
        val older = submission(
            """
            {"fieldId":"hjelp","fieldType":"MULTI_CHOICE",
             "question":{"label":"Gammel tekst","options":[{"id":"a","label":"Gammel A"},{"id":"c","label":"C"}]},
             "value":{"type":"multiChoice","selectedOptionIds":["a","c"]}}
            """.trimIndent(),
        )

        val first = m.map(row(newer, id = "new", receivedAt = Instant.parse("2026-10-19T10:00:00Z"))).shouldNotBeNull()
        val second = m.map(row(older, id = "old", receivedAt = Instant.parse("2026-10-18T10:00:00Z"))).shouldNotBeNull()

        first.svar.map { it.valgId to it.valgTekst } shouldContainExactly listOf("a" to "Ny tekst A", "b" to "B")
        second.svar.map { it.valgId to it.valgTekst } shouldContainExactly listOf("a" to "Ny tekst A", "c" to "C")
        second.svar.map { it.sporsmalTekst }.distinct() shouldContainExactly listOf("Hva hjalp?")
    }

    test("maps a single choice and falls back to the option id without a label") {
        val mapped = mapper().map(
            row(
                submission(
                    """
                    {"fieldId":"prioritering","fieldType":"SINGLE_CHOICE","question":{"label":"Prioritering"},
                     "value":{"type":"singleChoice","selectedOptionId":"enklere"}}
                    """.trimIndent(),
                ),
            ),
        ).shouldNotBeNull()

        mapped.svar.single().valgId shouldBe "enklere"
        mapped.svar.single().valgTekst shouldBe "enklere"
        mapped.svar.single().sporsmalType shouldBe "SINGLE_CHOICE"
    }

    test("leaves free text out unless the team has turned it on") {
        val text = """
            {"fieldId":"innspill","fieldType":"TEXT","question":{"label":"Innspill"},
             "value":{"type":"text","text":"Send svar til ola.nordmann@example.com"}}
        """.trimIndent()

        val without = mapper().map(row(submission(text))).shouldNotBeNull()
        without.fritekst.shouldBeEmpty()
        without.innsending.harFritekst shouldBe true
        without.innsending.antallSvar shouldBe 1

        val with = mapper(includeFreeText = true).map(row(submission(text))).shouldNotBeNull()
        val fritekst = with.fritekst.single()
        fritekst.tekst shouldNotContain "ola.nordmann@example.com"
        fritekst.maskert shouldBe true
        fritekst.sporsmalTekst shouldBe "Innspill"
    }

    test("writes context tags as sorted compact JSON") {
        val mapped = mapper().map(row(submission(rating("opplevelse", 5, "emoji", 5)))).shouldNotBeNull()

        mapped.innsending.kontekst shouldBe """{"aktiv":true,"antall":3,"rolle":"sykmeldt"}"""
        mapped.svar.single().kontekst shouldBe mapped.innsending.kontekst
    }

    test("gives a stable pseudonym per key that never contains the internal id") {
        val id = "11111111-1111-1111-1111-111111111111"
        val first = mapper().map(row(submission(), id = id)).shouldNotBeNull().innsending.innsendingId
        val again = mapper().map(row(submission(), id = id)).shouldNotBeNull().innsending.innsendingId
        val otherKey = mapper(pseudonymKey = ByteArray(32) { 7 }).map(row(submission(), id = id))
            .shouldNotBeNull().innsending.innsendingId

        first shouldBe again
        first shouldNotBe otherKey
        first shouldMatch Regex("^[0-9a-f]{32}$")
        first shouldNotContain "1111"
    }

    test("skips submissions without survey id or with unreadable JSON") {
        val m = mapper()
        m.map(row(submission(), surveyId = null, id = "a")).shouldBeNull()
        m.map(row("{not json", id = "b")).shouldBeNull()
        m.map(row("[1,2,3]", id = "c")).shouldBeNull()
        m.skippedSubmissions shouldBe 3
    }

    test("skips answers whose field type and value type disagree, and duplicate fields") {
        val m = mapper()
        val mapped = m.map(
            row(
                submission(
                    """{"fieldId":"x","fieldType":"TEXT","question":{"label":"X"},"value":{"type":"rating","rating":3}}""",
                    rating("opplevelse", 3, "emoji", 5),
                    rating("opplevelse", 1, "emoji", 5),
                ),
            ),
        ).shouldNotBeNull()

        mapped.svar.single().ratingVerdi shouldBe 3
        m.skippedAnswers shouldBe 2
    }

    test("counts date answers without exporting them") {
        val mapped = mapper().map(
            row(
                submission(
                    """{"fieldId":"dato","fieldType":"DATE","question":{"label":"Når?"},"value":{"type":"date","date":"2026-10-01"}}""",
                ),
            ),
        ).shouldNotBeNull()

        mapped.svar.shouldBeEmpty()
        mapped.innsending.antallSvar shouldBe 1
    }

    test("normalizes unknown survey types and device types") {
        val mapped = mapper().map(
            row("""{"surveyType":"noe-nytt","context":{"deviceType":"tv"},"answers":[]}"""),
        ).shouldNotBeNull()

        mapped.innsending.surveyType shouldBe "custom"
        mapped.innsending.enhetstype.shouldBeNull()
        mapped.innsending.kontekst.shouldBeNull()
    }

    test("survives explicit JSON null in context and answers") {
        val mapped = mapper().map(row("""{"surveyType":"rating","context":null,"answers":null}""")).shouldNotBeNull()

        mapped.innsending.antallSvar shouldBe 0
        mapped.innsending.enhetstype.shouldBeNull()
    }

    test("redacts personal data in client labels and keeps the archive flag") {
        val mapped = mapper().map(
            row(submission(rating("opplevelse", 4, "emoji", 5, label = "Spør kari.nordmann@example.com")), archived = true),
        ).shouldNotBeNull()

        mapped.svar.single().sporsmalTekst shouldNotContain "kari.nordmann@example.com"
        mapped.svar.single().surveyArkivert shouldBe true
        mapped.innsending.surveyArkivert shouldBe true
    }

    test("refuses rows that are not ordered newest first") {
        val m = mapper()
        m.map(row(submission(), id = "a", receivedAt = Instant.parse("2026-10-18T10:00:00Z")))
        shouldThrow<IllegalStateException> {
            m.map(row(submission(), id = "b", receivedAt = Instant.parse("2026-10-19T10:00:00Z")))
        }
    }
})
