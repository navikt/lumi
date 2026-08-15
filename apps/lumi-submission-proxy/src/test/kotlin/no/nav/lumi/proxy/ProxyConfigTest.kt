package no.nav.lumi.proxy

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class ProxyConfigTest {
    private val requiredValues = mapOf(
        "LUMI_API_BASE_URL" to "http://api:8080",
        "LUMI_INTERNAL_SUBMISSION_KEY" to "local-key",
    )

    @Test
    fun `fails closed when Texas and local bypass are both absent`() {
        assertFailsWith<IllegalArgumentException> {
            ProxyConfig.fromEnvironment(requiredValues::get)
        }
    }

    @Test
    fun `allows explicit local bypass without Texas`() {
        val values = requiredValues + ("LUMI_LOCAL_AUTH_BYPASS" to "true")

        val config = ProxyConfig.fromEnvironment(values::get)

        assertTrue(config.localAuthBypassEnabled)
        assertEquals(null, config.tokenIntrospectionEndpoint)
    }

    @Test
    fun `uses Texas without enabling local bypass`() {
        val values = requiredValues +
            mapOf(
                "NAIS_CLUSTER_NAME" to "dev-gcp",
                "NAIS_TOKEN_INTROSPECTION_ENDPOINT" to "http://texas/introspect",
            )

        val config = ProxyConfig.fromEnvironment(values::get)

        assertFalse(config.localAuthBypassEnabled)
        assertEquals("http://texas/introspect", config.tokenIntrospectionEndpoint)
    }

    @Test
    fun `rejects local bypass inside a NAIS cluster`() {
        val values = requiredValues +
            mapOf(
                "NAIS_CLUSTER_NAME" to "dev-gcp",
                "LUMI_LOCAL_AUTH_BYPASS" to "true",
            )

        val error = assertFailsWith<IllegalArgumentException> {
            ProxyConfig.fromEnvironment(values::get)
        }

        assertTrue(error.message.orEmpty().contains("must never be enabled inside a NAIS cluster"))
    }
}
