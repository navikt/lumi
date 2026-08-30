package no.nav.lumi.domain

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import kotlinx.serialization.json.jsonPrimitive

class AnalysisContractCompilerTest : FunSpec({
    val compiler = AnalysisContractCompiler()

    test("produces deterministic schemas and synthetic preview without trusting client labels") {
        val source = catalogSource(
            fields = listOf(
                catalogField("score", FieldType.RATING, RatingVariant.NPS, 11),
                catalogField("reason", FieldType.SINGLE_CHOICE, optionIds = listOf("a", "b")),
                catalogField(
                    "priorities",
                    FieldType.MULTI_CHOICE,
                    optionIds = listOf("first", "second"),
                    maxSelections = 2,
                ),
            ),
        )
        val catalog = catalogSnapshot(listOf(source))
        val document = productDocument(
            sources = listOf(
                AnalysisProductSourceSelection(
                    app = "my-app",
                    surveyId = "survey-one",
                    fieldIds = listOf("score", "reason", "priorities"),
                ),
            ),
            dimensionKeys = listOf("deviceType"),
            includeSubmittedHour = true,
        )

        val first = compiler.compilePreview(compilationInput(document, catalog))
        val second = compiler.compilePreview(
            compilationInput(
                document.copy(
                    sources = document.sources.reversed().map { it.copy(fieldIds = it.fieldIds.reversed()) },
                    dimensionKeys = document.dimensionKeys.reversed(),
                ),
                catalog.copy(sources = catalog.sources.reversed()),
            ),
        )

        first.baseSchemaDigest shouldBe second.baseSchemaDigest
        first.resources shouldBe second.resources
        first.schemaVersion shouldBe 2
        first.dataOrigin shouldBe PreviewDataOrigin.SYNTHETIC
        first.status shouldBe AnalysisContractPreviewStatus.BLOCKED
        first.issues.map { it.code } shouldContain AnalysisCompilationIssueCode.FLOW_NOT_PINNED
        first.resources shouldHaveSize 4

        val wide = first.resources.single { it.kind == AnalysisResourceKind.WIDE }
        wide.name.startsWith("responses_my_app_survey_one_") shouldBe true
        wide.columns.single { it.name == "submitted_hour" }.type shouldBe AnalysisColumnType.TIMESTAMP
        wide.columns.any { it.logicalId == "field:score:rating" && it.type == AnalysisColumnType.INT64 } shouldBe true
        wide.columns.any { it.logicalId == "field:reason:option_id" && it.type == AnalysisColumnType.STRING } shouldBe true
        wide.columns.count { it.logicalId.startsWith("field:priorities:option:") } shouldBe 2
        wide.columns.any { it.logicalId == "dimension:deviceType" } shouldBe true
        wide.syntheticRows shouldHaveSize 1
        wide.syntheticRows.single().getValue("flow_hash").jsonPrimitive.content.matches(
            Regex("^[0-9a-f]{64}$"),
        ) shouldBe true

        val serialized = AnalysisContractJson.encodeToString(AnalysisProductContractPreviewV2.serializer(), first)
        serialized.contains("untrusted question label") shouldBe false
        serialized.contains("untrusted option label") shouldBe false
        serialized.contains("feedback_json") shouldBe false
        serialized.contains("internal-feedback-id") shouldBe false
        serialized.contains("2000-01-01") shouldBe true
    }

    test("keeps equal survey IDs in different apps separate") {
        val catalog = catalogSnapshot(
            listOf(
                catalogSource(app = "app-a"),
                catalogSource(app = "app-b"),
            ),
        )
        val document = productDocument(
            sources = listOf(
                AnalysisProductSourceSelection("app-a", "survey-one", listOf("score")),
                AnalysisProductSourceSelection("app-b", "survey-one", listOf("score")),
            ),
        )

        val preview = compiler.compilePreview(compilationInput(document, catalog))

        preview.resources.count { it.kind == AnalysisResourceKind.WIDE } shouldBe 2
        preview.resources.filter { it.kind == AnalysisResourceKind.WIDE }.map { it.name }.distinct().size shouldBe 2
    }

    test("pins complete field and dimension contracts when provenance is available") {
        val firstSource = catalogSource(
            fields = listOf(catalogField("reason", FieldType.SINGLE_CHOICE, optionIds = listOf("a", "b"))),
        ).withPinnedContracts()
        val secondSource = catalogSource(
            fields = listOf(catalogField("reason", FieldType.SINGLE_CHOICE, optionIds = listOf("a", "b", "c"))),
        ).withPinnedContracts(definitionHash = "e".repeat(64))
        val document = productDocument(
            sources = listOf(AnalysisProductSourceSelection("my-app", "survey-one", listOf("reason"))),
            dimensionKeys = listOf("deviceType"),
            includeSubmittedHour = true,
        )

        val first = compiler.compilePreview(compilationInput(document, catalogSnapshot(listOf(firstSource))))
        val second = compiler.compilePreview(compilationInput(document, catalogSnapshot(listOf(secondSource))))

        first.status shouldBe AnalysisContractPreviewStatus.READY
        first.publicationSpecification shouldNotBe null
        val specification = requireNotNull(first.publicationSpecification)
        specification.schemaVersion shouldBe 2
        specification.includeSubmittedHour shouldBe true
        specification.sources.single().definitions.single().fields.single().availableOptionIds shouldBe listOf("a", "b")
        specification.dimensions.single().allowedValues shouldBe listOf("desktop", "mobile", "tablet")
        first.baseSchemaDigest shouldBe second.baseSchemaDigest
        first.publicationSpecificationDigest shouldNotBe second.publicationSpecificationDigest
        first.catalogRevision shouldNotBe second.catalogRevision
    }

    test("pins all known flow revisions and warns without inventing legacy flow") {
        val currentFlow = "f".repeat(64)
        val earlierFlow = "e".repeat(64)
        val sourceFields = listOf(
            catalogField("score", FieldType.RATING, RatingVariant.NPS, 11).copy(
                flowDependencies = listOf(
                    AnalysisFlowDependencyV1(AnalysisFlowDependencySource.METADATA, "deviceType"),
                ),
            ),
        )
        val source = catalogSource(
            fields = sourceFields,
        ).withPinnedContracts(
            revisions = listOf(
                catalogContractRevision(flowHash = earlierFlow, fields = sourceFields),
                catalogContractRevision(flowHash = currentFlow, fields = sourceFields),
            ),
            currentFlowHash = currentFlow,
        ).copy(
            observedFlowHashes = listOf(null, earlierFlow, currentFlow),
            warnings = listOf(AnalysisCatalogWarning.LEGACY_FLOW_OBSERVED),
        )
        val document = productDocument(
            listOf(AnalysisProductSourceSelection("my-app", "survey-one", listOf("score"))),
            dimensionKeys = listOf("deviceType"),
        )

        val preview = compiler.compilePreview(compilationInput(document, catalogSnapshot(listOf(source))))

        preview.status shouldBe AnalysisContractPreviewStatus.READY_WITH_WARNINGS
        preview.issues.map { it.code } shouldContain AnalysisCompilationIssueCode.UNPINNED_FLOW_HISTORY_EXCLUDED
        preview.publicationSpecification?.sources?.single()?.definitions?.single()?.flows?.map { it.flowHash } shouldBe
            listOf(earlierFlow, currentFlow)
    }

    test("pins historical definitions without creating false definition-flow combinations") {
        val firstDefinitionHash = "c".repeat(64)
        val secondDefinitionHash = "d".repeat(64)
        val firstFlowHash = "e".repeat(64)
        val secondFlowHash = "f".repeat(64)
        val firstFields = listOf(catalogField("score", FieldType.RATING, RatingVariant.NPS, 11))
        val secondFields = firstFields +
            catalogField("reason", FieldType.SINGLE_CHOICE, optionIds = listOf("a", "b"))
        val source = catalogSource(fields = secondFields).withPinnedContracts(
            definitionHash = secondDefinitionHash,
            currentFlowHash = firstFlowHash,
            revisions = listOf(
                catalogContractRevision(firstDefinitionHash, firstFlowHash, firstFields),
                catalogContractRevision(secondDefinitionHash, secondFlowHash, secondFields),
            ),
        )
        val document = productDocument(
            sources = listOf(
                AnalysisProductSourceSelection("my-app", "survey-one", listOf("score", "reason")),
            ),
        )

        val preview = compiler.compilePreview(compilationInput(document, catalogSnapshot(listOf(source))))

        preview.status shouldBe AnalysisContractPreviewStatus.READY
        val definitions = requireNotNull(preview.publicationSpecification).sources.single().definitions
        definitions.map { it.definitionHash } shouldBe listOf(firstDefinitionHash, secondDefinitionHash)
        definitions[0].flows.map { it.flowHash } shouldBe listOf(firstFlowHash)
        definitions[1].flows.map { it.flowHash } shouldBe listOf(secondFlowHash)
        definitions[0].fields.single { it.fieldId == "reason" }.presence shouldBe AnalysisFieldPresence.ABSENT
        definitions[1].fields.single { it.fieldId == "reason" }.presence shouldBe AnalysisFieldPresence.PRESENT
        definitions[1].fields.single { it.fieldId == "reason" }.availableOptionIds shouldBe listOf("a", "b")
    }

    test("blocks a current definition that has no exact observed contract revision") {
        val historicalFields = listOf(catalogField("score", FieldType.RATING, RatingVariant.NPS, 11))
        val currentFields = listOf(catalogField("score", FieldType.SINGLE_CHOICE, optionIds = listOf("yes", "no")))
        val historicalFlowHash = "e".repeat(64)
        val source = catalogSource(fields = currentFields).withPinnedContracts(
            definitionHash = "d".repeat(64),
            currentFlowHash = historicalFlowHash,
            revisions = listOf(
                catalogContractRevision(
                    definitionHash = "c".repeat(64),
                    flowHash = historicalFlowHash,
                    fields = historicalFields,
                ),
            ),
        )
        val document = productDocument(
            sources = listOf(AnalysisProductSourceSelection("my-app", "survey-one", listOf("score"))),
        )

        val preview = compiler.compilePreview(compilationInput(document, catalogSnapshot(listOf(source))))

        preview.status shouldBe AnalysisContractPreviewStatus.BLOCKED
        preview.issues.map { it.code } shouldContain AnalysisCompilationIssueCode.CONTRACT_REVISION_UNAVAILABLE
        preview.publicationSpecification shouldBe null
    }

    test("blocks a selected field that is absent from every exact contract revision") {
        val currentFields = listOf(
            catalogField("score", FieldType.RATING, RatingVariant.NPS, 11),
            catalogField("reason", FieldType.SINGLE_CHOICE, optionIds = listOf("yes", "no")),
        )
        val source = catalogSource(fields = currentFields).withPinnedContracts(
            revisions = listOf(
                catalogContractRevision(fields = currentFields.take(1)),
            ),
        )
        val document = productDocument(
            sources = listOf(AnalysisProductSourceSelection("my-app", "survey-one", listOf("reason"))),
        )

        val preview = compiler.compilePreview(compilationInput(document, catalogSnapshot(listOf(source))))

        preview.status shouldBe AnalysisContractPreviewStatus.BLOCKED
        preview.issues.map { it.code } shouldContain AnalysisCompilationIssueCode.CONTRACT_REVISION_UNAVAILABLE
        preview.publicationSpecification shouldBe null
    }

    test("blocks incompatible field semantics across definition revisions") {
        val currentFields = listOf(catalogField("score", FieldType.RATING, RatingVariant.NPS, 11))
        val source = catalogSource(fields = currentFields).withPinnedContracts(
            revisions = listOf(
                catalogContractRevision(
                    definitionHash = "c".repeat(64),
                    flowHash = "e".repeat(64),
                    fields = listOf(catalogField("score", FieldType.RATING, RatingVariant.EMOJI, 5)),
                ),
                catalogContractRevision(fields = currentFields),
            ),
        )
        val document = productDocument(
            sources = listOf(AnalysisProductSourceSelection("my-app", "survey-one", listOf("score"))),
        )

        val preview = compiler.compilePreview(compilationInput(document, catalogSnapshot(listOf(source))))

        preview.status shouldBe AnalysisContractPreviewStatus.BLOCKED
        preview.issues.map { it.code } shouldContain AnalysisCompilationIssueCode.CONTRACT_REVISION_CONFLICT
        preview.publicationSpecification shouldBe null
    }

    test("blocks changed multi-choice selection semantics across definition revisions") {
        val currentFields = listOf(
            catalogField(
                "reason",
                FieldType.MULTI_CHOICE,
                optionIds = listOf("a", "b"),
                maxSelections = 2,
            ),
        )
        val source = catalogSource(fields = currentFields).withPinnedContracts(
            revisions = listOf(
                catalogContractRevision(
                    definitionHash = "c".repeat(64),
                    flowHash = "e".repeat(64),
                    fields = listOf(
                        catalogField(
                            "reason",
                            FieldType.MULTI_CHOICE,
                            optionIds = listOf("a", "b"),
                            maxSelections = 1,
                        ),
                    ),
                ),
                catalogContractRevision(fields = currentFields),
            ),
        )
        val document = productDocument(
            sources = listOf(AnalysisProductSourceSelection("my-app", "survey-one", listOf("reason"))),
        )

        val preview = compiler.compilePreview(compilationInput(document, catalogSnapshot(listOf(source))))

        preview.status shouldBe AnalysisContractPreviewStatus.BLOCKED
        preview.issues.map { it.code } shouldContain AnalysisCompilationIssueCode.CONTRACT_REVISION_CONFLICT
    }

    test("blocks malformed exact contract revision shapes") {
        val field = catalogField("score", FieldType.RATING, RatingVariant.NPS, 11)
        val malformedRevision = catalogContractRevision(fields = listOf(field, field)).copy(
            dependenciesByField = listOf(
                AnalysisFieldDependenciesV1("score", emptyList()),
                AnalysisFieldDependenciesV1("score", emptyList()),
            ),
        )
        val source = catalogSource(fields = listOf(field)).withPinnedContracts(
            revisions = listOf(malformedRevision),
        )
        val document = productDocument(
            sources = listOf(AnalysisProductSourceSelection("my-app", "survey-one", listOf("score"))),
        )

        val preview = compiler.compilePreview(compilationInput(document, catalogSnapshot(listOf(source))))

        preview.status shouldBe AnalysisContractPreviewStatus.BLOCKED
        preview.issues.map { it.code } shouldContain AnalysisCompilationIssueCode.CONTRACT_REVISION_CONFLICT
        preview.publicationSpecification shouldBe null
    }

    test("serialized public catalogs cannot silently cross the trusted compiler boundary") {
        val source = catalogSource().withPinnedContracts()
        val catalog = catalogSnapshot(listOf(source))
        val publicRoundTrip = AnalysisContractJson.decodeFromString(
            AnalysisSourceCatalogV1.serializer(),
            AnalysisContractJson.encodeToString(AnalysisSourceCatalogV1.serializer(), catalog),
        )
        val document = productDocument(
            sources = listOf(AnalysisProductSourceSelection("my-app", "survey-one", listOf("score"))),
        )

        val preview = compiler.compilePreview(compilationInput(document, publicRoundTrip))

        preview.status shouldBe AnalysisContractPreviewStatus.BLOCKED
        preview.issues.map { it.code } shouldContain AnalysisCompilationIssueCode.CONTRACT_REVISION_UNAVAILABLE
        preview.publicationSpecification shouldBe null
    }

    test("wide schema includes the union of allowed historical multi-choice options") {
        val firstDefinitionHash = "c".repeat(64)
        val currentFields = listOf(
            catalogField("reason", FieldType.MULTI_CHOICE, optionIds = listOf("a")),
        )
        val source = catalogSource(fields = currentFields).withPinnedContracts(
            revisions = listOf(
                catalogContractRevision(
                    definitionHash = firstDefinitionHash,
                    flowHash = "e".repeat(64),
                    fields = listOf(
                        catalogField("reason", FieldType.MULTI_CHOICE, optionIds = listOf("a", "b")),
                    ),
                ),
                catalogContractRevision(fields = currentFields),
            ),
        )
        val document = productDocument(
            sources = listOf(AnalysisProductSourceSelection("my-app", "survey-one", listOf("reason"))),
        )

        val preview = compiler.compilePreview(compilationInput(document, catalogSnapshot(listOf(source))))

        preview.status shouldBe AnalysisContractPreviewStatus.READY
        preview.resources.single { it.kind == AnalysisResourceKind.WIDE }.columns
            .filter { it.logicalId.startsWith("field:reason:option:") }
            .map { it.logicalId } shouldBe listOf(
            "field:reason:option:a:selected",
            "field:reason:option:b:selected",
        )
        requireNotNull(preview.publicationSpecification).sources.single().definitions
            .single { it.definitionHash == firstDefinitionHash }
            .fields.single().availableOptionIds shouldBe listOf("a", "b")
    }

    test("blocks a conditional field until its flow dependency is selected") {
        val source = catalogSource(
            fields = listOf(
                catalogField("score", FieldType.RATING, RatingVariant.NPS, 11).copy(
                    flowDependencies = listOf(
                        AnalysisFlowDependencyV1(AnalysisFlowDependencySource.METADATA, "deviceType"),
                    ),
                ),
            ),
        ).withPinnedContracts()
        val selection = listOf(AnalysisProductSourceSelection("my-app", "survey-one", listOf("score")))

        val blocked = compiler.compilePreview(
            compilationInput(productDocument(selection), catalogSnapshot(listOf(source))),
        )
        val ready = compiler.compilePreview(
            compilationInput(
                productDocument(selection, dimensionKeys = listOf("deviceType")),
                catalogSnapshot(listOf(source)),
            ),
        )

        blocked.status shouldBe AnalysisContractPreviewStatus.BLOCKED
        blocked.issues.map { it.code } shouldContain AnalysisCompilationIssueCode.FLOW_DEPENDENCY_NOT_SELECTED
        ready.status shouldBe AnalysisContractPreviewStatus.READY
    }

    test("publication specification binds retention") {
        val source = catalogSource().withPinnedContracts()
        val sourceSelection = listOf(AnalysisProductSourceSelection("my-app", "survey-one", listOf("score")))
        val shortRetention = compiler.compilePreview(
            compilationInput(
                productDocument(sourceSelection).copy(retention = AnalysisProductRetention.DAYS_30),
                catalogSnapshot(listOf(source)),
            ),
        )
        val sourceMaximum = compiler.compilePreview(
            compilationInput(
                productDocument(sourceSelection).copy(retention = AnalysisProductRetention.SOURCE_MAXIMUM),
                catalogSnapshot(listOf(source)),
            ),
        )

        shortRetention.baseSchemaDigest shouldBe sourceMaximum.baseSchemaDigest
        shortRetention.publicationSpecification?.retention shouldBe AnalysisProductRetention.DAYS_30
        shortRetention.publicationSpecificationDigest shouldNotBe sourceMaximum.publicationSpecificationDigest
    }

    test("selection revision ignores unrelated catalog sources and unselected fields") {
        val selected = catalogSource().withPinnedContracts()
        val selectedWithExtraField = selected.copy(
            fields = selected.fields + catalogField("not-selected", FieldType.RATING, RatingVariant.EMOJI, 5),
        )
        val unrelated = catalogSource(app = "another-app").withPinnedContracts(flowHash = "e".repeat(64))
        val document = productDocument(
            sources = listOf(AnalysisProductSourceSelection("my-app", "survey-one", listOf("score"))),
        )

        val baseline = compiler.compilePreview(compilationInput(document, catalogSnapshot(listOf(selected))))
        val expandedCatalog = compiler.compilePreview(
            compilationInput(document, catalogSnapshot(listOf(selectedWithExtraField, unrelated))),
        )

        baseline.catalogRevision shouldBe expandedCatalog.catalogRevision
        baseline.publicationSpecificationDigest shouldBe expandedCatalog.publicationSpecificationDigest
    }

    test("uses the exact documented resource shapes and never manifests the manifest itself") {
        val preview = compiler.compilePreview(
            compilationInput(
                productDocument(
                    sources = listOf(AnalysisProductSourceSelection("my-app", "survey-one", listOf("score"))),
                ),
                catalogSnapshot(listOf(catalogSource())),
            ),
        )

        preview.resources.map { it.kind } shouldBe listOf(
            AnalysisResourceKind.WIDE,
            AnalysisResourceKind.LONG,
            AnalysisResourceKind.FIELD_CATALOG,
            AnalysisResourceKind.MANIFEST,
        )
        preview.resources.single { it.kind == AnalysisResourceKind.LONG }.columns.map { it.name } shouldBe listOf(
            "response_key", "answer_key", "product_id", "product_release", "product_snapshot_id",
            "team_slug", "app", "survey_id", "survey_type", "submitted_date", "definition_hash",
            "definition_status", "flow_hash", "flow_status", "field_id", "field_type",
            "field_metadata_hash", "value_kind", "rating_value", "option_id",
            "option_metadata_hash", "selection_count",
        )
        preview.resources.single { it.kind == AnalysisResourceKind.MANIFEST }.columns.map { it.name } shouldBe listOf(
            "product_id", "product_release", "product_snapshot_id", "resource_name", "resource_kind",
            "schema_digest", "row_count", "contract_version", "source_snapshot_at", "published_at",
            "data_cutoff_at", "snapshot_mode", "quality_status",
        )
        preview.resources.single { it.kind == AnalysisResourceKind.MANIFEST }
            .syntheticRows.single().getValue("resource_name").jsonPrimitive.content shouldNotBe "product_manifest_v1"
    }

    test("fails closed for foreign, unknown, forbidden and malformed selections") {
        val malformed = catalogField(
            fieldId = "bad-choice",
            fieldType = FieldType.SINGLE_CHOICE,
            optionIds = listOf("same", "same"),
        )
        val catalog = catalogSnapshot(
            listOf(
                catalogSource(
                    definitionStatus = AnalysisDefinitionStatus.AUTO_DERIVED,
                    fields = listOf(
                        catalogField("comment", FieldType.TEXT),
                        malformed,
                    ),
                ),
            ),
        )
        val document = productDocument(
            sources = listOf(
                AnalysisProductSourceSelection(
                    "my-app",
                    "survey-one",
                    listOf("comment", "bad-choice", "missing"),
                ),
            ),
            dimensionKeys = listOf("context.tags.secret"),
        )

        val preview = compiler.compilePreview(compilationInput(document, catalog))

        preview.status shouldBe AnalysisContractPreviewStatus.BLOCKED
        preview.issues.map { it.code }.toSet() shouldBe setOf(
            AnalysisCompilationIssueCode.DEFINITION_NOT_REGISTERED,
            AnalysisCompilationIssueCode.FLOW_NOT_PINNED,
            AnalysisCompilationIssueCode.FIELD_NOT_ALLOWED,
            AnalysisCompilationIssueCode.FIELD_MALFORMED,
            AnalysisCompilationIssueCode.FIELD_UNAVAILABLE,
            AnalysisCompilationIssueCode.DIMENSION_UNAVAILABLE,
        )
        preview.publicationSpecification shouldBe null
    }

    test("fails closed for missing and malformed provenance hashes") {
        val source = catalogSource().copy(
            definitionHash = null,
            observedDefinitionHashes = emptyList(),
            flowHash = "not-a-hash",
            flowStatus = AnalysisFlowStatus.PINNED,
        )
        val document = productDocument(
            sources = listOf(AnalysisProductSourceSelection("my-app", "survey-one", listOf("score"))),
        )

        val preview = compiler.compilePreview(compilationInput(document, catalogSnapshot(listOf(source))))

        preview.status shouldBe AnalysisContractPreviewStatus.BLOCKED
        preview.issues.map { it.code }.toSet() shouldBe setOf(
            AnalysisCompilationIssueCode.DEFINITION_HASH_UNRESOLVED,
            AnalysisCompilationIssueCode.FLOW_NOT_PINNED,
        )
        preview.publicationSpecification shouldBe null
    }

    test("synthetic option rows preserve exact metadata references and selections") {
        val field = catalogField(
            "choice",
            FieldType.MULTI_CHOICE,
            optionIds = listOf("a", "x:a:y"),
            maxSelections = 2,
        )
        val preview = compiler.compilePreview(
            compilationInput(
                productDocument(
                    sources = listOf(AnalysisProductSourceSelection("my-app", "survey-one", listOf("choice"))),
                ),
                catalogSnapshot(listOf(catalogSource(fields = listOf(field)))),
            ),
        )

        val wide = preview.resources.single { it.kind == AnalysisResourceKind.WIDE }
        val wideRow = wide.syntheticRows.single()
        val optionColumns = wide.columns.filter { it.logicalId.endsWith(":selected") }
        wideRow.getValue(optionColumns[0].name).jsonPrimitive.content shouldBe "true"
        wideRow.getValue(optionColumns[1].name).jsonPrimitive.content shouldBe "false"

        val longRow = preview.resources.single { it.kind == AnalysisResourceKind.LONG }.syntheticRows.single()
        val catalogRows = preview.resources.single { it.kind == AnalysisResourceKind.FIELD_CATALOG }.syntheticRows
        catalogRows.map { it.getValue("entry_kind").jsonPrimitive.content } shouldBe listOf("FIELD", "OPTION")
        longRow.getValue("field_metadata_hash") shouldBe catalogRows[0].getValue("metadata_hash")
        longRow.getValue("option_metadata_hash") shouldBe catalogRows[1].getValue("metadata_hash")
        longRow.getValue("option_id") shouldBe catalogRows[1].getValue("option_id")
    }

    test("manifest synthetic row uses the actual first resource kind") {
        val preview = compiler.compilePreview(
            compilationInput(productDocument(sources = emptyList()), catalogSnapshot(emptyList())),
        )

        val manifestRow = preview.resources.single { it.kind == AnalysisResourceKind.MANIFEST }.syntheticRows.single()
        manifestRow.getValue("resource_name").jsonPrimitive.content shouldBe "answers_long_v1"
        manifestRow.getValue("resource_kind").jsonPrimitive.content shouldBe "LONG"
    }

    test("warns at 80 dynamic columns and blocks only above 120") {
        fun previewFor(ratingFields: Int, dimensions: List<String> = emptyList()): AnalysisProductContractPreviewV2 {
            val fields = (1..ratingFields).map { catalogField("rating-$it", FieldType.RATING, RatingVariant.EMOJI, 5) }
            val source = catalogSource(fields = fields)
            return compiler.compilePreview(
                compilationInput(
                    productDocument(
                        sources = listOf(
                            AnalysisProductSourceSelection(
                                "my-app",
                                "survey-one",
                                fields.map { it.fieldId },
                            ),
                        ),
                        dimensionKeys = dimensions,
                    ),
                    catalogSnapshot(listOf(source)),
                ),
            )
        }

        previewFor(39).issues.any { it.code == AnalysisCompilationIssueCode.WIDE_COLUMN_BUDGET_WARNING } shouldBe false
        previewFor(40).issues.any { it.code == AnalysisCompilationIssueCode.WIDE_COLUMN_BUDGET_WARNING } shouldBe true
        previewFor(60).issues.any { it.code == AnalysisCompilationIssueCode.WIDE_COLUMN_BUDGET_EXCEEDED } shouldBe false
        previewFor(61).issues.any { it.code == AnalysisCompilationIssueCode.WIDE_COLUMN_BUDGET_EXCEEDED } shouldBe true
    }

    test("physical names are bounded and contain no SQL metacharacters") {
        val unsafe = AnalysisPhysicalNames.resourceName(
            app = "Å SELECT * FROM x; -- " + "a".repeat(200),
            surveyId = "1/../../survey" + "b".repeat(200),
        )

        (unsafe.length <= 128) shouldBe true
        unsafe.matches(Regex("^[a-z][a-z0-9_]*$")) shouldBe true
        unsafe.contains("select", ignoreCase = true) shouldBe true
        unsafe.contains(";") shouldBe false
        unsafe.contains("-") shouldBe false
    }
})

private fun compilationInput(
    document: AnalysisProductDocumentV1,
    catalog: AnalysisSourceCatalogV1,
) = AnalysisProductCompilationInput(
    productId = "00000000-0000-0000-0000-000000000001",
    team = "team-a",
    draftId = "00000000-0000-0000-0000-000000000002",
    draftRevision = 1,
    documentHash = "a".repeat(64),
    document = document,
    catalog = catalog,
    dimensions = AnalysisDimensionRegistry.snapshot(),
)

private fun productDocument(
    sources: List<AnalysisProductSourceSelection>,
    dimensionKeys: List<String> = emptyList(),
    includeSubmittedHour: Boolean = false,
) = AnalysisProductDocumentV1(
    name = "Analysis",
    purpose = "Safe analysis",
    dataOwner = "owner",
    technicalOwner = "technical-owner",
    useCases = listOf(AnalysisProductUseCase.METABASE),
    retention = AnalysisProductRetention.SOURCE_MAXIMUM,
    reviewDate = "2027-08-29",
    sources = sources,
    dimensionKeys = dimensionKeys,
    includeSubmittedHour = includeSubmittedHour,
)

private fun catalogSnapshot(sources: List<AnalysisCatalogSourceV1>) = AnalysisSourceCatalogV1(
    team = "team-a",
    catalogRevision = AnalysisCatalogRevision.compute("team-a", sources, AnalysisDimensionRegistry.snapshot()),
    sources = sources,
    dimensions = AnalysisDimensionRegistry.snapshot().dimensions,
)

private fun catalogSource(
    app: String = "my-app",
    definitionStatus: AnalysisDefinitionStatus = AnalysisDefinitionStatus.REGISTERED,
    fields: List<AnalysisCatalogFieldV1> = listOf(
        catalogField("score", FieldType.RATING, RatingVariant.NPS, 11),
    ),
) = AnalysisCatalogSourceV1(
    app = app,
    surveyId = "survey-one",
    surveyType = SurveyType.CUSTOM,
    archived = false,
    definitionHash = "d".repeat(64),
    definitionStatus = definitionStatus,
    observedDefinitionHashes = listOf("d".repeat(64)),
    flowStatus = AnalysisFlowStatus.UNPINNED,
    fields = fields,
    warnings = emptyList(),
)

private fun catalogField(
    fieldId: String,
    fieldType: FieldType,
    ratingVariant: RatingVariant? = null,
    ratingScale: Int? = null,
    optionIds: List<String>? = null,
    maxSelections: Int? = null,
) = AnalysisCatalogFieldV1(
    fieldId = fieldId,
    fieldType = fieldType,
    ratingVariant = ratingVariant,
    ratingScale = ratingScale,
    optionIds = optionIds,
    maxSelections = maxSelections,
    label = null,
    labelSource = AnalysisLabelSource.UNKNOWN,
)

private fun AnalysisCatalogSourceV1.withPinnedContracts(
    definitionHash: String = this.definitionHash ?: "d".repeat(64),
    flowHash: String = "f".repeat(64),
    revisions: List<AnalysisCatalogContractRevision> = listOf(
        catalogContractRevision(
            definitionHash = definitionHash,
            flowHash = flowHash,
            fields = fields,
        ),
    ),
    currentFlowHash: String = flowHash,
): AnalysisCatalogSourceV1 = copy(
    definitionHash = definitionHash,
    observedDefinitionHashes = revisions.map { it.definitionHash }.distinct().sorted(),
    flowHash = currentFlowHash,
    flowHashes = revisions.map { it.flowHash }.distinct().sorted(),
    observedFlowHashes = revisions.map { it.flowHash }.distinct().sorted(),
    flowStatus = AnalysisFlowStatus.PINNED,
    contractRevisions = revisions,
)

private fun catalogContractRevision(
    definitionHash: String = "d".repeat(64),
    flowHash: String = "f".repeat(64),
    fields: List<AnalysisCatalogFieldV1>,
): AnalysisCatalogContractRevision = AnalysisCatalogContractRevision(
    definitionHash = definitionHash,
    flowHash = flowHash,
    surveyType = SurveyType.CUSTOM,
    fields = fields,
    evaluatorVersion = SURVEY_FLOW_EVALUATOR_VERSION,
    dependenciesByField = fields.map { field ->
        AnalysisFieldDependenciesV1(field.fieldId, field.flowDependencies)
    },
)
