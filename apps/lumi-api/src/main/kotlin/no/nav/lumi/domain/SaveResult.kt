package no.nav.lumi.domain

sealed interface SaveResult {
    val id: String

    data class Created(override val id: String) : SaveResult

    data class Duplicate(override val id: String) : SaveResult
}
