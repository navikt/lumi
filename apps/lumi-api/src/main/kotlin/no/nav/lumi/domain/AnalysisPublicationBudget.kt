package no.nav.lumi.domain

import kotlinx.serialization.encodeToString

/** Per-release storage/expansion limits, not a claim about transport capacity. */
object AnalysisPublicationBudget {
    const val MAX_SPECIFICATION_BYTES = 1024 * 1024
    const val MAX_EFFECTIVE_ATOMS = 10_000L

    fun violations(specification: AnalysisPublicationSpecificationV2): List<AnalysisCompilationIssueCode> = buildList {
        if (AnalysisContractJson.encodeToString(specification).toByteArray(Charsets.UTF_8).size > MAX_SPECIFICATION_BYTES) {
            add(AnalysisCompilationIssueCode.SPECIFICATION_BYTE_BUDGET_EXCEEDED)
        }
        if (effectiveAtomCount(specification) > MAX_EFFECTIVE_ATOMS) {
            add(AnalysisCompilationIssueCode.SPECIFICATION_ATOM_BUDGET_EXCEEDED)
        }
    }

    fun effectiveAtomCount(specification: AnalysisPublicationSpecificationV2): Long =
        specification.dimensions.size.toLong() + specification.sources.sumOf { source ->
            1L + source.selectedFieldIds.size + source.definitions.sumOf { definition ->
                1L + definition.fields.sumOf { 1L + it.availableOptionIds.size } +
                    definition.flows.sumOf { flow ->
                        1L + flow.dependenciesByField.sumOf { it.dependencies.size.toLong() }
                    }
            }
        }
}
