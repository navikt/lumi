package no.nav.lumi.config

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

class ServerEnvTest {

    @Test
    fun `parseTeamEntraGroups returns empty map when env is missing`() {
        assertEquals(emptyMap<String, String>(), parseTeamEntraGroups(null))
        assertEquals(emptyMap<String, String>(), parseTeamEntraGroups("   "))
    }

    @Test
    fun `parseTeamEntraGroups parses valid mappings`() {
        val parsed = parseTeamEntraGroups(
            "team-esyfo=1FAC48F0-9744-4D44-A5B5-E2C8AA2CA42B; flex=7c0dd32a-1896-4e14-96f6-a7eadc73f5f5",
        )

        assertEquals(
            mapOf(
                "team-esyfo" to "1fac48f0-9744-4d44-a5b5-e2c8aa2ca42b",
                "flex" to "7c0dd32a-1896-4e14-96f6-a7eadc73f5f5",
            ),
            parsed,
        )
    }

    @Test
    fun `parseTeamEntraGroups fails on invalid entry format`() {
        val exception = assertThrows<IllegalArgumentException> {
            parseTeamEntraGroups("team-esyfo")
        }

        assertTrue(exception.message.orEmpty().contains("must use format"))
    }

    @Test
    fun `parseTeamEntraGroups fails on blank team or group`() {
        val blankTeam = assertThrows<IllegalArgumentException> {
            parseTeamEntraGroups(" =1fac48f0-9744-4d44-a5b5-e2c8aa2ca42b")
        }
        val blankGroup = assertThrows<IllegalArgumentException> {
            parseTeamEntraGroups("team-esyfo=")
        }

        assertTrue(blankTeam.message.orEmpty().contains("blank team"))
        assertTrue(blankGroup.message.orEmpty().contains("blank group UUID"))
    }

    @Test
    fun `parseTeamEntraGroups fails on invalid UUID`() {
        val exception = assertThrows<IllegalArgumentException> {
            parseTeamEntraGroups("team-esyfo=not-a-uuid")
        }

        assertTrue(exception.message.orEmpty().contains("invalid group UUID"))
    }

    @Test
    fun `parseTeamEntraGroups fails on duplicate team`() {
        val exception = assertThrows<IllegalArgumentException> {
            parseTeamEntraGroups(
                "team-esyfo=1fac48f0-9744-4d44-a5b5-e2c8aa2ca42b;team-esyfo=7c0dd32a-1896-4e14-96f6-a7eadc73f5f5",
            )
        }

        assertTrue(exception.message.orEmpty().contains("duplicate mapping"))
    }

    @Test
    fun `parseTeamEntraGroups fails on duplicate group UUID across teams`() {
        val exception = assertThrows<IllegalArgumentException> {
            parseTeamEntraGroups(
                "team-esyfo=1fac48f0-9744-4d44-a5b5-e2c8aa2ca42b;flex=1FAC48F0-9744-4D44-A5B5-E2C8AA2CA42B",
            )
        }

        assertTrue(exception.message.orEmpty().contains("duplicate mapping for group UUID"))
    }
}
