---
name: kafka-topic
description: Add Kafka topic configuration to Nais manifest and create Rapids & Rivers event handler
---

You are helping configure Kafka integration for a Nav application using the Rapids & Rivers pattern.

NOTE: `lumi-api` does not currently use Kafka/Rapids & Rivers. Only apply this prompt if the repo is explicitly being extended with Kafka.

## Step 1: Add Kafka Configuration to Nais Manifest

Update the relevant manifest(s) to include Kafka:

```yaml
kafka:
  pool: nav-dev # or nav-prod for production
```

## Step 2: Create Event Handler

Ask the user:

1. **Event name**: What event should this handler listen for?
2. **Required fields**: What fields must be present in the event?
3. **Optional fields**: What fields are optional?
4. **Action**: What should happen when this event is received?

### Kotlin Implementation

Create a River for handling the event:

```kotlin
package no.nav.your.package.rivers

import no.nav.helse.rapids_rivers.*

class YourEventRiver(rapidsConnection: RapidsConnection) : River.PacketListener {
    init {
        River(rapidsConnection).apply {
            validate { it.demandValue("@event_name", "your_event_name") }
            validate { it.requireKey("required_field_1", "required_field_2") }
            validate { it.interestedIn("optional_field") }
        }.register(this)
    }

    override fun onPacket(packet: JsonMessage, context: MessageContext) {
        val requiredField = packet["required_field_1"].asText()
        val optionalField = packet["optional_field"].takeIf { !it.isMissingOrNull() }?.asText()

        // Process the event
        logger.info { "Processing event: ${packet["@event_name"].asText()}" }

        // Perform business logic
        val result = processEvent(requiredField, optionalField)

        // Publish response event if needed
        val response = JsonMessage.newNeed(
            listOf("RequiredCapability"),
            mapOf(
                "correlation_id" to packet["@id"].asText(),
                "result" to result,
                "processed_at" to LocalDateTime.now().toString()
            )
        )
        context.publish(requiredField, response.toJson())
    }

    private fun processEvent(field1: String, field2: String?): String {
        // Business logic here
        return "processed"
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
```

## Step 3: Create Test

Generate a test for the event handler.

## Boundaries

### ⚠️ Ask First

- Introducing Kafka/Rapids & Rivers in this repo
