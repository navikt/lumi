package no.nav.lumi.repository

import no.nav.lumi.domain.FeedbackDbRecord

internal data class PaginatedSnapshot(
    val records: List<FeedbackDbRecord>,
    val tagsById: Map<String, List<String>>,
    val total: Long,
    val page: Int
)

internal data class RecordsSnapshot(
    val records: List<FeedbackDbRecord>,
    val tagsById: Map<String, List<String>>
)
