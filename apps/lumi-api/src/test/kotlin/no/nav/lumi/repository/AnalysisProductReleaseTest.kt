package no.nav.lumi.repository

import io.kotest.core.spec.style.FunSpec
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.shouldBe
import io.kotest.matchers.collections.shouldHaveSize
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.header
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.testApplication
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.JsonPrimitive
import no.nav.lumi.TestDatabase
import no.nav.lumi.createTestClient
import no.nav.lumi.domain.*
import no.nav.lumi.service.AnalysisProductPreviewService
import no.nav.lumi.service.SubmissionService
import no.nav.lumi.testModule
import java.time.LocalDate
import java.time.ZoneOffset
import java.sql.SQLException
import java.util.UUID

class AnalysisProductReleaseTest : FunSpec({
    val repository = AnalysisProductRepository()
    beforeSpec { TestDatabase.initialize() }
    beforeTest { TestDatabase.clearAllData() }

    test("seals the confirmed V2 preview atomically without selecting or activating delivery") {
        val fixture = releaseFixture(repository)
        val result = repository.publishRelease(fixture.team, fixture.id, fixture.request, "A123456")
            as PublishAnalysisProductReleaseResult.Published
        result.created shouldBe true
        result.release.releaseNumber shouldBe 1
        result.release.publicationSpecification["schemaVersion"] shouldBe JsonPrimitive(2)
        result.release.publicationSpecificationDigest shouldBe fixture.request.publicationSpecificationDigest
        result.release.sourceDocumentHash shouldBe fixture.request.documentHash
        result.release.sourceDraftRevision shouldBe fixture.request.draftRevision
        val product = repository.findById(fixture.team, fixture.id)!!
        product.draft shouldBe null
        product.rowVersion shouldBe 3
        product.lastReleaseNumber shouldBe 1
        product.lifecycleState shouldBe AnalysisProductLifecycleState.DRAFT
        product.activeReleaseNumber shouldBe null
        product.desiredReleaseNumber shouldBe null
        repository.findAuditEvents(fixture.team, fixture.id)!!.map { it.eventType } shouldBe listOf(
            AnalysisProductAuditEventType.PRODUCT_CREATED,
            AnalysisProductAuditEventType.DRAFT_VALIDATED,
            AnalysisProductAuditEventType.RELEASE_PUBLISHED,
        )
        countRows("analysis_effective_plan_generations") shouldBe 0
    }

    test("retry returns the same immutable release without another audit event") {
        val fixture = releaseFixture(repository)
        val first = repository.publishRelease(fixture.team, fixture.id, fixture.request, "A123456")
            as PublishAnalysisProductReleaseResult.Published
        val second = repository.publishRelease(fixture.team, fixture.id, fixture.request, "A654321")
            as PublishAnalysisProductReleaseResult.Published
        second.created shouldBe false
        second.release shouldBe first.release
        repository.findAuditEvents(fixture.team, fixture.id)!!.size shouldBe 3
        repository.publishRelease(
            fixture.team, fixture.id, fixture.request.copy(publicationSpecificationDigest = "a".repeat(64)), "A123456",
        ) shouldBe PublishAnalysisProductReleaseResult.PreviewConflict
    }

    test("a late database rejection rolls back validation release and audit together") {
        val fixture = releaseFixture(repository)
        // Fault injection exists only in this disposable Testcontainers database.
        TestDatabase.dataSource.connection.use { connection ->
            connection.createStatement().use {
                it.execute("""
                    ALTER TABLE analysis_control.analysis_product_audit_events
                    ADD CONSTRAINT reject_release_for_test CHECK (event_type <> 'RELEASE_PUBLISHED') NOT VALID
                """.trimIndent())
            }
            connection.commit()
        }
        try {
            shouldThrow<SQLException> {
                repository.publishRelease(fixture.team, fixture.id, fixture.request, "A123456")
            }
            val product = repository.findById(fixture.team, fixture.id)!!
            product.rowVersion shouldBe 1
            product.lastReleaseNumber shouldBe 0
            product.draft!!.validation shouldBe null
            product.draft!!.id shouldBe fixture.request.draftId
            repository.findReleases(fixture.team, fixture.id)!! shouldHaveSize 0
            repository.findAuditEvents(fixture.team, fixture.id)!!.size shouldBe 1
        } finally {
            TestDatabase.dataSource.connection.use { connection ->
                connection.createStatement().use {
                    it.execute("ALTER TABLE analysis_control.analysis_product_audit_events DROP CONSTRAINT reject_release_for_test")
                }
                connection.commit()
            }
        }
        (repository.publishRelease(fixture.team, fixture.id, fixture.request, "A123456")
            as PublishAnalysisProductReleaseResult.Published).created shouldBe true
    }

    test("concurrent confirmations create exactly one release") {
        val fixture = releaseFixture(repository)
        val results = coroutineScope {
            (1..4).map {
                async(Dispatchers.IO) {
                    repository.publishRelease(fixture.team, fixture.id, fixture.request, "A123456")
                        as PublishAnalysisProductReleaseResult.Published
                }
            }.awaitAll()
        }
        results.count { it.created } shouldBe 1
        results.map { it.release.id }.distinct().size shouldBe 1
        repository.findReleases(fixture.team, fixture.id)!!.size shouldBe 1
    }

    test("editing the draft invalidates the old confirmation without persisting validation") {
        val fixture = releaseFixture(repository)
        repository.updateDraft(
            fixture.team, fixture.id, UUID.fromString(fixture.request.draftId), fixture.request.draftRevision,
            fixture.document.copy(name = "Changed purpose label"), "A123456",
        )
        repository.publishRelease(fixture.team, fixture.id, fixture.request, "A123456") shouldBe
            PublishAnalysisProductReleaseResult.PreviewConflict
        repository.findReleases(fixture.team, fixture.id)!! shouldHaveSize 0
        repository.findById(fixture.team, fixture.id)!!.draft!!.validation shouldBe null
        repository.findAuditEvents(fixture.team, fixture.id)!!.size shouldBe 2
    }

    test("a changed selected source catalog invalidates confirmation") {
        val fixture = releaseFixture(repository)
        registerReleaseSource(fixture.team, unpinned = true)
        registerReleaseSource(fixture.team)
        repository.publishRelease(fixture.team, fixture.id, fixture.request, "A123456") shouldBe
            PublishAnalysisProductReleaseResult.PreviewConflict
        repository.findReleases(fixture.team, fixture.id)!! shouldHaveSize 0
        repository.findById(fixture.team, fixture.id)!!.draft!!.validation shouldBe null
        repository.findAuditEvents(fixture.team, fixture.id)!!.size shouldBe 1
    }

    test("unrelated team catalog changes do not invalidate a confirmed selection") {
        val fixture = releaseFixture(repository)
        registerReleaseSource("team-esyfo", unpinned = true)
        (repository.publishRelease(fixture.team, fixture.id, fixture.request, "A123456")
            as PublishAnalysisProductReleaseResult.Published).created shouldBe true
    }

    test("foreign and missing products are indistinguishable and cannot create releases") {
        val fixture = releaseFixture(repository)
        repository.publishRelease("team-esyfo", fixture.id, fixture.request, "A123456") shouldBe
            PublishAnalysisProductReleaseResult.NotFound
        repository.publishRelease(fixture.team, UUID.randomUUID(), fixture.request, "A123456") shouldBe
            PublishAnalysisProductReleaseResult.NotFound
        repository.findReleases(fixture.team, fixture.id)!! shouldHaveSize 0
    }

    test("offboarding rejects a new release without mutating the draft") {
        val fixture = releaseFixture(repository)
        repository.beginOffboarding(fixture.team, fixture.id, 1, "A123456")
        repository.publishRelease(fixture.team, fixture.id, fixture.request, "A123456") shouldBe
            PublishAnalysisProductReleaseResult.InvalidLifecycle
        repository.findReleases(fixture.team, fixture.id)!! shouldHaveSize 0
        repository.findById(fixture.team, fixture.id)!!.draft!!.validation shouldBe null
    }

    test("concurrent edit and confirmation cannot publish an unconfirmed draft") {
        val fixture = releaseFixture(repository)
        coroutineScope {
            val publish = async(Dispatchers.IO) {
                repository.publishRelease(fixture.team, fixture.id, fixture.request, "A123456")
            }
            val edit = async(Dispatchers.IO) {
                repository.updateDraft(
                    fixture.team, fixture.id, UUID.fromString(fixture.request.draftId), 1,
                    fixture.document.copy(name = "Concurrent edit"), "A654321",
                )
            }
            when (val result = publish.await()) {
                is PublishAnalysisProductReleaseResult.Published -> {
                    result.release.sourceDocument.name shouldBe fixture.document.name
                    edit.await() shouldBe UpdateAnalysisProductDraftResult.NotFound
                }
                else -> {
                    result shouldBe PublishAnalysisProductReleaseResult.PreviewConflict
                    (edit.await() as UpdateAnalysisProductDraftResult.Updated).product.draft!!.revision shouldBe 2
                }
            }
        }
    }

    test("HTTP confirms a server preview and retries safely with the authenticated actor") {
        val fixture = releaseFixture(repository)
        testApplication {
            application { testModule() }
            val client = createTestClient()
            val url = "/api/v1/intern/analysis-products/${fixture.id}/releases?team=${fixture.team}"
            client.post(url) {
                contentType(ContentType.Application.Json)
                setBody(fixture.request)
            }.status shouldBe HttpStatusCode.Unauthorized
            val first = client.post(url) {
                header(HttpHeaders.Authorization, "Bearer token")
                contentType(ContentType.Application.Json)
                setBody(fixture.request)
            }
            first.status shouldBe HttpStatusCode.Created
            val release = first.body<AnalysisProductRelease>()
            release.publishedBy shouldBe "A123456"
            val retry = client.post(url) {
                header(HttpHeaders.Authorization, "Bearer token")
                contentType(ContentType.Application.Json)
                setBody(fixture.request)
            }
            retry.status shouldBe HttpStatusCode.OK
            retry.body<AnalysisProductRelease>().id shouldBe release.id
            val listed = client.get(url) { header(HttpHeaders.Authorization, "Bearer token") }
            listed.body<List<AnalysisProductRelease>>().map { it.id } shouldBe listOf(release.id)
        }
    }

    test("HTTP rejects caller-owned team or SQL and oversized confirmations") {
        val fixture = releaseFixture(repository)
        testApplication {
            application { testModule() }
            val client = createTestClient()
            val url = "/api/v1/intern/analysis-products/${fixture.id}/releases?team=${fixture.team}"
            for (extra in listOf("\"team\":\"team-esyfo\"", "\"sql\":\"SELECT *\"", "\"actor\":\"other\"")) {
                client.post(url) {
                    header(HttpHeaders.Authorization, "Bearer token")
                    contentType(ContentType.Application.Json)
                    setBody(AnalysisContractJson.encodeToString(fixture.request).dropLast(1) + "," + extra + "}")
                }.status shouldBe HttpStatusCode.BadRequest
            }
            client.post(url) {
                header(HttpHeaders.Authorization, "Bearer token")
                contentType(ContentType.Application.Json)
                setBody(" ".repeat(4097))
            }.status shouldBe HttpStatusCode.PayloadTooLarge
        }
        repository.findReleases(fixture.team, fixture.id)!! shouldHaveSize 0
    }

    test("population-only selection seals no answer fields and never means all fields") {
        val fixture = releaseFixture(repository)
        repository.updateDraft(
            fixture.team, fixture.id, UUID.fromString(fixture.request.draftId), 1,
            fixture.document.copy(sources = listOf(AnalysisProductSourceSelection("app", "survey"))), "A123456",
        )
        val preview = AnalysisProductPreviewService().preview(fixture.team, fixture.id)!!
        val published = repository.publishRelease(fixture.team, fixture.id, preview.confirmation(), "A123456")
            as PublishAnalysisProductReleaseResult.Published
        val specification = AnalysisContractJson.decodeFromJsonElement(
            AnalysisPublicationSpecificationV2.serializer(), published.release.publicationSpecification,
        )
        specification.sources.single().selectedFieldIds shouldBe emptyList()
        specification.sources.single().definitions.all { it.fields.isEmpty() } shouldBe true
        specification.resources.single { it.kind == AnalysisResourceKind.WIDE }.columns.any {
            it.logicalId.startsWith("field:")
        } shouldBe false
    }

    test("replay after offboarding cannot reopen delivery") {
        val fixture = releaseFixture(repository)
        repository.publishRelease(fixture.team, fixture.id, fixture.request, "A123456")
        repository.beginOffboarding(fixture.team, fixture.id, 3, "A123456")
        val result = repository.publishRelease(fixture.team, fixture.id, fixture.request, "A123456")
            as PublishAnalysisProductReleaseResult.Published
        result.created shouldBe false
        val product = repository.findById(fixture.team, fixture.id)!!
        product.lifecycleState shouldBe AnalysisProductLifecycleState.OFFBOARDING
        product.activeReleaseNumber shouldBe null
        product.desiredReleaseNumber shouldBe null
        product.rowVersion shouldBe 4
    }

    test("HTTP supports create edit preview and release using only server-owned state") {
        registerReleaseSource("team-test")
        val document = releaseDocument()
        testApplication {
            application { testModule() }
            val client = createTestClient()
            val base = "/api/v1/intern/analysis-products"
            val created = client.post("$base?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer token")
                contentType(ContentType.Application.Json)
                setBody(document)
            }
            created.status shouldBe HttpStatusCode.Created
            val product = created.body<AnalysisProduct>()
            product.team shouldBe "team-test"
            val update = UpdateAnalysisProductDraftRequest(product.draft!!.id, 1, document.copy(name = "Reviewed pilot"))
            val updated = client.put("$base/${product.id}/draft?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer token")
                contentType(ContentType.Application.Json)
                setBody(update)
            }
            updated.status shouldBe HttpStatusCode.OK
            updated.body<AnalysisProduct>().draft!!.revision shouldBe 2
            client.put("$base/${product.id}/draft?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer token")
                contentType(ContentType.Application.Json)
                setBody(update)
            }.status shouldBe HttpStatusCode.Conflict
            val previewResponse = client.get("$base/${product.id}/preview?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer token")
            }
            val preview = previewResponse.body<AnalysisProductContractPreviewV2>()
            val published = client.post("$base/${product.id}/releases?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer token")
                contentType(ContentType.Application.Json)
                setBody(preview.confirmation())
            }
            published.status shouldBe HttpStatusCode.Created
            published.body<AnalysisProductRelease>().sourceDocument.name shouldBe "Reviewed pilot"
            val detail = client.get("$base/${product.id}?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer token")
            }.body<AnalysisProduct>()
            detail.draft shouldBe null
            detail.lastReleaseNumber shouldBe 1
            detail.activeReleaseNumber shouldBe null
            client.get("$base?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer token")
            }.body<List<AnalysisProduct>>().map { it.id } shouldBe listOf(product.id)
            client.get("$base?team=team-esyfo") {
                header(HttpHeaders.Authorization, "Bearer token")
            }.body<List<AnalysisProduct>>() shouldBe emptyList()
        }
    }

    test("HTTP hides foreign IDs on every read and write surface") {
        val fixture = releaseFixture(repository)
        testApplication {
            application { testModule() }
            val client = createTestClient()
            val base = "/api/v1/intern/analysis-products"
            for (suffix in listOf("", "/releases", "/preview")) {
                val foreign = client.get("$base/${fixture.id}$suffix?team=team-esyfo") {
                    header(HttpHeaders.Authorization, "Bearer token")
                }
                val missing = client.get("$base/${UUID.randomUUID()}$suffix?team=team-esyfo") {
                    header(HttpHeaders.Authorization, "Bearer token")
                }
                foreign.status shouldBe HttpStatusCode.NotFound
                foreign.body<String>() shouldBe missing.body<String>()
            }
            val foreignRelease = client.post("$base/${fixture.id}/releases?team=team-esyfo") {
                header(HttpHeaders.Authorization, "Bearer token")
                contentType(ContentType.Application.Json)
                setBody(fixture.request)
            }
            foreignRelease.status shouldBe HttpStatusCode.NotFound
            client.put("$base/${fixture.id}/draft?team=team-esyfo") {
                header(HttpHeaders.Authorization, "Bearer token")
                contentType(ContentType.Application.Json)
                setBody(UpdateAnalysisProductDraftRequest(fixture.request.draftId, 1, fixture.document))
            }.status shouldBe HttpStatusCode.NotFound
            client.post("$base?team=unavailable-team") {
                header(HttpHeaders.Authorization, "Bearer token")
                contentType(ContentType.Application.Json)
                setBody(fixture.document)
            }.status shouldBe HttpStatusCode.Forbidden
        }
    }
})

private data class ReleaseFixture(
    val id: UUID,
    val team: String,
    val document: AnalysisProductDocumentV1,
    val request: PublishAnalysisProductReleaseRequest,
)

private suspend fun releaseFixture(repository: AnalysisProductRepository): ReleaseFixture {
    val team = "team-test"
    registerReleaseSource(team)
    val document = releaseDocument()
    val product = (repository.create(team, document, "A123456") as CreateAnalysisProductResult.Created).product
    val id = UUID.fromString(product.id)
    val preview = AnalysisProductPreviewService().preview(team, id)!!
    return ReleaseFixture(id, team, document, preview.confirmation())
}

private fun releaseDocument() = AnalysisProductDocumentV1(
        name = "Pilot", purpose = "Structured survey analysis", dataOwner = "A123456", technicalOwner = "A123456",
        useCases = listOf(AnalysisProductUseCase.METABASE), retention = AnalysisProductRetention.DAYS_90,
        reviewDate = LocalDate.now(ZoneOffset.UTC).plusMonths(6).toString(),
        sources = listOf(AnalysisProductSourceSelection("app", "survey", listOf("rating"))),
)

private fun AnalysisProductContractPreviewV2.confirmation() = PublishAnalysisProductReleaseRequest(
    draftId, draftRevision, documentHash, catalogRevision, checkNotNull(publicationSpecificationDigest),
)

private suspend fun registerReleaseSource(team: String, unpinned: Boolean = false) {
    val definition = SurveyDefinition(
        surveyId = "survey", surveyType = SurveyType.CUSTOM,
        fields = listOf(FieldDefinition("rating", FieldType.RATING, RatingVariant.NPS, 11, null)),
    )
    // Unpinned history affects contract coverage without changing field schema.
    val flow = SurveyFlowDefinitionV1(
        schemaVersion = 1, evaluatorVersion = SURVEY_FLOW_EVALUATOR_VERSION,
        fields = listOf(SurveyFlowFieldDefinition("rating")),
    )
    val submission = FeedbackSubmissionV1(
        schemaVersion = 2, surveyId = "survey", surveyType = SurveyType.CUSTOM,
        submittedAt = "2026-09-08T12:00:00Z",
        answers = listOf(Answer("rating", FieldType.RATING, Question("Client label"), AnswerValue.Rating(5, RatingVariant.NPS, 11))),
    )
    SubmissionService().submit(
        AnalysisContractJson.encodeToString(submission), team, "app", submission, definition,
        if (unpinned) null else flow,
    )
}

private fun countRows(table: String): Int = TestDatabase.dataSource.connection.use { connection ->
    connection.createStatement().use { statement ->
        statement.executeQuery("SELECT count(*) FROM analysis_control.$table").use { rows ->
            rows.next()
            rows.getInt(1)
        }
    }
}
