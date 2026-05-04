package no.nav.lumi.sensitive

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.shouldBe
import kotlinx.serialization.json.*

class JsonRedactorTest : FunSpec({

    val redactor = JsonRedactor()

    context("string value redaction") {
        test("redacts fødselsnummer in string value") {
            val input = JsonObject(mapOf("bruker" to JsonPrimitive("01020349294")))
            val (result, wasRedacted) = redactor.redactJsonElement(input)
            wasRedacted shouldBe true
            result.jsonObject["bruker"]?.jsonPrimitive?.content shouldBe "[FØDSELSNUMMER FJERNET]"
        }

        test("leaves clean string values unchanged") {
            val input = JsonObject(mapOf("team" to JsonPrimitive("flex")))
            val (result, wasRedacted) = redactor.redactJsonElement(input)
            wasRedacted shouldBe false
            result.jsonObject["team"]?.jsonPrimitive?.content shouldBe "flex"
        }

        test("redacts email in value") {
            val input = JsonObject(mapOf("contact" to JsonPrimitive("ola@nav.no")))
            val (result, wasRedacted) = redactor.redactJsonElement(input)
            wasRedacted shouldBe true
            result.jsonObject["contact"]?.jsonPrimitive?.content shouldBe "[E-POST FJERNET]"
        }
    }

    context("key redaction") {
        test("redacts PII in object key") {
            val input = JsonObject(mapOf("01020349294" to JsonPrimitive("data")))
            val (result, wasRedacted) = redactor.redactJsonElement(input)
            wasRedacted shouldBe true
            val keys = result.jsonObject.keys
            keys shouldBe setOf("[REDACTED_KEY_1]")
            result.jsonObject["[REDACTED_KEY_1]"]?.jsonPrimitive?.content shouldBe "data"
        }

        test("redacts multiple PII keys with incrementing counter") {
            val input = JsonObject(mapOf(
                "01020349294" to JsonPrimitive("a"),
                "ola@nav.no" to JsonPrimitive("b")
            ))
            val (result, wasRedacted) = redactor.redactJsonElement(input)
            wasRedacted shouldBe true
            result.jsonObject.keys shouldBe setOf("[REDACTED_KEY_1]", "[REDACTED_KEY_2]")
        }

        test("avoids collision with existing key named REDACTED_KEY_1") {
            val input = JsonObject(mapOf(
                "01020349294" to JsonPrimitive("pii-data"),
                "[REDACTED_KEY_1]" to JsonPrimitive("legitimate-data")
            ))
            val (result, wasRedacted) = redactor.redactJsonElement(input)
            wasRedacted shouldBe true
            // Should skip [REDACTED_KEY_1] since it already exists as an original key
            val keys = result.jsonObject.keys
            keys.size shouldBe 2
            keys shouldContain "[REDACTED_KEY_1]"
            // The PII key should get a different placeholder
            result.jsonObject["[REDACTED_KEY_1]"]?.jsonPrimitive?.content shouldBe "legitimate-data"
        }
    }

    context("nested objects") {
        test("recursively redacts nested object values") {
            val input = JsonObject(mapOf(
                "nested" to JsonObject(mapOf(
                    "value" to JsonPrimitive("ring 98765432")
                ))
            ))
            val (result, wasRedacted) = redactor.redactJsonElement(input)
            wasRedacted shouldBe true
            val nested = result.jsonObject["nested"]?.jsonObject
            nested?.get("value")?.jsonPrimitive?.content shouldBe "ring [TELEFON FJERNET]"
        }

        test("deeply nested redaction") {
            val input = JsonObject(mapOf(
                "a" to JsonObject(mapOf(
                    "b" to JsonObject(mapOf(
                        "c" to JsonPrimitive("mitt fnr er 01020349294")
                    ))
                ))
            ))
            val (result, wasRedacted) = redactor.redactJsonElement(input)
            wasRedacted shouldBe true
        }
    }

    context("arrays") {
        test("redacts PII in array elements") {
            val input = JsonObject(mapOf(
                "items" to JsonArray(listOf(
                    JsonObject(mapOf("fnr" to JsonPrimitive("01020349294")))
                ))
            ))
            val (result, wasRedacted) = redactor.redactJsonElement(input)
            wasRedacted shouldBe true
            val item = result.jsonObject["items"]?.jsonArray?.first()?.jsonObject
            item?.get("fnr")?.jsonPrimitive?.content shouldBe "[FØDSELSNUMMER FJERNET]"
        }
    }

    context("number values") {
        test("small numbers are not redacted") {
            val input = JsonObject(mapOf("count" to JsonPrimitive(42)))
            val (result, wasRedacted) = redactor.redactJsonElement(input)
            wasRedacted shouldBe false
            result.jsonObject["count"]?.jsonPrimitive?.content shouldBe "42"
        }

        test("numeric phone number is redacted") {
            val input = JsonObject(mapOf("phone" to JsonPrimitive(98765432)))
            val (result, wasRedacted) = redactor.redactJsonElement(input)
            wasRedacted shouldBe true
            result.jsonObject["phone"]?.jsonPrimitive?.content shouldBe "[TELEFON FJERNET]"
        }

        test("numeric value in nested debug object is redacted") {
            val input = JsonObject(mapOf(
                "debug" to JsonObject(mapOf(
                    "callerPhone" to JsonPrimitive(98765432)
                ))
            ))
            val (result, wasRedacted) = redactor.redactJsonElement(input)
            wasRedacted shouldBe true
        }
    }

    context("edge cases") {
        test("null JSON values are preserved") {
            val input = JsonObject(mapOf("field" to JsonNull))
            val (result, wasRedacted) = redactor.redactJsonElement(input)
            wasRedacted shouldBe false
            result.jsonObject["field"] shouldBe JsonNull
        }

        test("boolean values are preserved") {
            val input = JsonObject(mapOf("active" to JsonPrimitive(true)))
            val (result, wasRedacted) = redactor.redactJsonElement(input)
            wasRedacted shouldBe false
            result.jsonObject["active"]?.jsonPrimitive?.content shouldBe "true"
        }

        test("empty object returns empty") {
            val input = JsonObject(emptyMap())
            val (result, wasRedacted) = redactor.redactJsonElement(input)
            wasRedacted shouldBe false
            result.jsonObject.size shouldBe 0
        }
    }
})
