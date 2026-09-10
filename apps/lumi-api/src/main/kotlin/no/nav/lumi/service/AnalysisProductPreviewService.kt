package no.nav.lumi.service

import no.nav.lumi.domain.AnalysisContractCompiler
import no.nav.lumi.domain.AnalysisDimensionRegistry
import no.nav.lumi.domain.AnalysisProductCompilationInput
import no.nav.lumi.domain.AnalysisProductContractPreviewV2
import no.nav.lumi.repository.AnalysisProductRepository
import no.nav.lumi.repository.AnalysisSourceCatalogRepository
import java.util.UUID

class AnalysisProductPreviewService(
    private val productRepository: AnalysisProductRepository = AnalysisProductRepository(),
    private val catalogRepository: AnalysisSourceCatalogRepository = AnalysisSourceCatalogRepository(),
    private val compiler: AnalysisContractCompiler = AnalysisContractCompiler(),
) {
    suspend fun catalog(team: String) = catalogRepository.findCatalog(team)

    suspend fun preview(team: String, productId: UUID): AnalysisProductContractPreviewV2? {
        val product = productRepository.findById(team, productId) ?: return null
        val draft = product.draft ?: return null
        val catalog = catalogRepository.findCatalog(team)
        return compiler.compilePreview(
            AnalysisProductCompilationInput(
                productId = product.id,
                team = team,
                draftId = draft.id,
                draftRevision = draft.revision,
                documentHash = draft.documentHash,
                document = draft.document,
                catalog = catalog,
                dimensions = AnalysisDimensionRegistry.snapshot(),
            ),
        )
    }
}
