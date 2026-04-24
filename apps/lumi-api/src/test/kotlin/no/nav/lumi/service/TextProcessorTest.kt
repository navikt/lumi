package no.nav.lumi.service

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.collections.shouldNotContain
import io.kotest.matchers.shouldBe
import no.nav.lumi.service.text.NorwegianLightStemmer

class TextProcessorTest : FunSpec({

    context("extractWords") {
        test("filters out stop words") {
            val text = "Jeg har en søknad og det er bra"
            val words = TextProcessor.extractWords(text)
            
            words shouldNotContain "jeg"
            words shouldNotContain "har"
            words shouldNotContain "en"
            words shouldNotContain "og"
            words shouldContain "søknad"
        }

        test("removes special characters") {
            val text = "Hallo! Dette er en test-melding."
            val words = TextProcessor.extractWords(text)
            
            words shouldContain "hallo"
            words shouldContain "test"
            words shouldContain "melding"
        }

        test("filters expanded stopwords (enten, disse, veldig)") {
            val text = "enten disse veldig mange fordi"
            val words = TextProcessor.extractWords(text)

            words shouldNotContain "enten"
            words shouldNotContain "disse"
            words shouldNotContain "veldig"
            words shouldNotContain "mange"
            words shouldNotContain "fordi"
        }

        test("filters Nav-specific noise words") {
            val text = "Takk for nav hjelpen"
            val words = TextProcessor.extractWords(text)

            words shouldNotContain "takk"
            words shouldNotContain "nav"
            words shouldContain "hjelpen"
        }

        test("filters modal verbs and opinion verbs") {
            val text = "jeg synes man bør kunne opplever tror vet"
            val words = TextProcessor.extractWords(text)

            words shouldNotContain "synes"
            words shouldNotContain "bør"
            words shouldNotContain "opplever"
            words shouldNotContain "tror"
            words shouldNotContain "vet"
        }

        test("filters nynorsk function words") {
            val text = "ikkje meir nokon korleis kvifor eigen"
            val words = TextProcessor.extractWords(text)

            words shouldNotContain "ikkje"
            words shouldNotContain "meir"
            words shouldNotContain "nokon"
            words shouldNotContain "korleis"
            words shouldNotContain "kvifor"
            words shouldNotContain "eigen"
        }

        test("does not filter English content words (no English stopwords)") {
            val text = "the feedback was very good and helpful"
            val words = TextProcessor.extractWords(text)

            // English words are NOT stopwords — they pass through as content
            words shouldContain "the"
            words shouldContain "feedback"
            words shouldContain "was"
            words shouldContain "very"
            words shouldContain "good"
        }

        test("strips redaction markers so PII labels do not appear as keywords") {
            val words = TextProcessor.extractWords(
                "Min fnr er [FØDSELSNUMMER FJERNET] og mail er [E-POST FJERNET]"
            )

            words shouldNotContain "fødselsnummer"
            words shouldNotContain "fjernet"
            words shouldContain "mail"
        }

        test("strips redaction markers without FJERNET suffix like HEMMELIG ADRESSE") {
            val words = TextProcessor.extractWords(
                "Bor på [HEMMELIG ADRESSE] og trenger hjelp"
            )

            words shouldNotContain "hemmelig"
            words shouldNotContain "adresse"
            words shouldContain "trenger"
            words shouldContain "hjelp"
        }
    }

    context("tokenize") {
        test("includes stopwords (for theme matching)") {
            val tokens = TextProcessor.tokenize("Takk for nav hjelpen")

            tokens shouldContain "takk"
            tokens shouldContain "nav"
            tokens shouldContain "hjelpen"
            tokens shouldContain "for" // tokenize keeps ALL words > 2 chars, including stopwords
        }

        test("preserves all words longer than 2 chars") {
            val tokens = TextProcessor.tokenize("enten disse veldig mange fordi")
            tokens shouldContain "enten"
            tokens shouldContain "disse"
            tokens shouldContain "veldig"
        }
    }

    context("extractBigrams") {
        test("pairs adjacent content words, skipping stopwords") {
            val bigrams = TextProcessor.extractBigrams("vanskelig å svare")
            bigrams shouldHaveSize 1
            bigrams[0].surface shouldBe "vanskelig svare"
        }

        test("generates multiple bigrams from content words") {
            val bigrams = TextProcessor.extractBigrams("dårlig design er helt forvirrende")
            bigrams shouldHaveSize 2
            bigrams[0].surface shouldBe "dårlig design"
            bigrams[1].surface shouldBe "design forvirrende"
        }

        test("returns empty for text with fewer than 2 content words") {
            TextProcessor.extractBigrams("bare stoppord og ja") shouldHaveSize 0
            TextProcessor.extractBigrams("hjelp") shouldHaveSize 0
            TextProcessor.extractBigrams("") shouldHaveSize 0
        }

        test("stem key groups inflected forms") {
            val bg1 = TextProcessor.extractBigrams("digitale søknader")
            val bg2 = TextProcessor.extractBigrams("digital søknaden")
            bg1[0].stemKey shouldBe bg2[0].stemKey
        }

        test("stem key uses pipe separator") {
            val bigrams = TextProcessor.extractBigrams("dårlig design")
            bigrams[0].stemKey.contains("|") shouldBe true
        }

        test("strips redaction markers before forming bigrams") {
            val bigrams = TextProcessor.extractBigrams("ring [TELEFON FJERNET] snarest")

            bigrams.map { it.surface } shouldNotContain "telefon"
            bigrams.any { it.surface == "ring snarest" } shouldBe true
        }

        test("strips multi-word redaction markers like MULIG NAVN FJERNET") {
            val bigrams = TextProcessor.extractBigrams("kontaktet [MULIG NAVN FJERNET] igår")

            bigrams.flatMap { it.surface.split(" ") } shouldNotContain "mulig"
            bigrams.flatMap { it.surface.split(" ") } shouldNotContain "navn"
            bigrams.any { it.surface == "kontaktet igår" } shouldBe true
        }
    }

    context("NorwegianLightStemmer") {
        test("stems definite plural (-ene)") {
            NorwegianLightStemmer.stem("søknadene") shouldBe "søknad"
            NorwegianLightStemmer.stem("husene") shouldBe "hus"
        }

        test("stems definite singular (-en, -et, -a)") {
            NorwegianLightStemmer.stem("søknaden") shouldBe "søknad"
            NorwegianLightStemmer.stem("huset") shouldBe "hus"
            NorwegianLightStemmer.stem("boka") shouldBe "bok"
        }

        test("stems indefinite plural (-er)") {
            NorwegianLightStemmer.stem("biler") shouldBe "bil"
            NorwegianLightStemmer.stem("søknader") shouldBe "søknad"
        }

        test("stems definite singular masculine (-en)") {
            NorwegianLightStemmer.stem("bilen") shouldBe "bil"
        }

        test("stems comparatives and superlatives") {
            NorwegianLightStemmer.stem("finere") shouldBe "fin"
            NorwegianLightStemmer.stem("fineste") shouldBe "fin"
        }

        test("stems -het / -heter / -heten abstractions") {
            NorwegianLightStemmer.stem("hemmelighet") shouldBe "hemmelig"
            NorwegianLightStemmer.stem("hemmeligheten") shouldBe "hemmelig"
            NorwegianLightStemmer.stem("hemmeligheter") shouldBe "hemmelig"
            // -ene is stripped first (single-pass) → "hemmelighet", not "hemmelig"
            NorwegianLightStemmer.stem("hemmelighetene") shouldBe "hemmelighet"
        }

        test("stems -dom") {
            NorwegianLightStemmer.stem("kristendom") shouldBe "kristen"
        }

        test("stems -else / -elser / -elsen") {
            NorwegianLightStemmer.stem("følelse") shouldBe "føl"
            NorwegianLightStemmer.stem("følelser") shouldBe "føl"
            NorwegianLightStemmer.stem("følelsen") shouldBe "føl"
        }

        test("strips possessive -s then further suffix") {
            NorwegianLightStemmer.stem("bilens") shouldBe "bil"
            NorwegianLightStemmer.stem("husets") shouldBe "hus"
        }

        test("does not stem very short words") {
            NorwegianLightStemmer.stem("et") shouldBe "et"
            NorwegianLightStemmer.stem("en") shouldBe "en"
            NorwegianLightStemmer.stem("bil") shouldBe "bil"
        }

        test("groups arbeidsgiver-variants under same stem") {
            val stem1 = NorwegianLightStemmer.stem("arbeidsgiver")
            val stem2 = NorwegianLightStemmer.stem("arbeidsgiveren")
            val stem3 = NorwegianLightStemmer.stem("arbeidsgivere")
            stem1 shouldBe stem2
            stem1 shouldBe stem3
        }

        test("Nav benefits stem consistently") {
            val syke1 = NorwegianLightStemmer.stem("sykepenger")
            val syke2 = NorwegianLightStemmer.stem("sykepengene")
            syke1 shouldBe syke2

            val dag1 = NorwegianLightStemmer.stem("dagpenger")
            val dag2 = NorwegianLightStemmer.stem("dagpengene")
            dag1 shouldBe dag2

            val foreldre1 = NorwegianLightStemmer.stem("foreldrepenger")
            val foreldre2 = NorwegianLightStemmer.stem("foreldrepengene")
            foreldre1 shouldBe foreldre2
        }
    }

    context("stemNorwegian (TextProcessor delegate)") {
        test("delegates to NorwegianLightStemmer") {
            TextProcessor.stemNorwegian("søknadene") shouldBe NorwegianLightStemmer.stem("søknadene")
            TextProcessor.stemNorwegian("Søknadene") shouldBe NorwegianLightStemmer.stem("søknadene")
        }
    }
})
