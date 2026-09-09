package no.nav.lumi.domain

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import kotlinx.serialization.json.*
import java.time.Instant

class AnalysisFlatProjectionTest : FunSpec({
    test("wide and long preserve zero, multiselect cardinality and metadata joins") {
        val fixture = ProjectionFixture()
        val result = fixture.project(listOf(fixture.row()))
        val wide = result.table(AnalysisResourceKind.WIDE).rows.single()
        wide[AnalysisPhysicalNames.fieldColumn("score", "rating")] shouldBe JsonPrimitive(0)
        wide[AnalysisPhysicalNames.fieldColumn("choices", "selection_count")] shouldBe JsonPrimitive(2)
        val long = result.table(AnalysisResourceKind.LONG).rows
        long.size shouldBe 4
        long.filter { it["field_id"] == JsonPrimitive("choices") }.map { it["answer_key"] }.distinct().size shouldBe 1
        val catalog = result.table(AnalysisResourceKind.FIELD_CATALOG).rows
        long.forEach { answer ->
            catalog.count { it["metadata_hash"] == answer["field_metadata_hash"] && it["entry_kind"] == JsonPrimitive("FIELD") } shouldBe 1
            if (answer["option_id"] != JsonNull) {
                catalog.count { it["metadata_hash"] == answer["option_metadata_hash"] && it["entry_kind"] == JsonPrimitive("OPTION") } shouldBe 1
            }
        }
        catalog.all { it["label_source"] == JsonPrimitive("UNKNOWN") && it["display_label"] == JsonNull } shouldBe true
        result.tables.none { it.schema.kind == AnalysisResourceKind.MANIFEST } shouldBe true
    }

    test("unanswered is different from explicit empty selection") {
        val fixture = ProjectionFixture()
        val missing = fixture.project(listOf(fixture.row(answers = emptyMap())))
        missing.table(AnalysisResourceKind.LONG).rows shouldBe emptyList()
        val wide = missing.table(AnalysisResourceKind.WIDE).rows.single()
        wide[AnalysisPhysicalNames.fieldColumn("score", "applicable")] shouldBe JsonPrimitive(true)
        wide[AnalysisPhysicalNames.fieldColumn("score", "rating")] shouldBe JsonNull
        wide[AnalysisPhysicalNames.fieldColumn("choices", "selection_count")] shouldBe JsonNull
        wide[AnalysisPhysicalNames.optionColumn("choices", "a")] shouldBe JsonNull

        val empty = fixture.project(listOf(fixture.row(answers = mapOf("choices" to AnalysisStructuredValue.Choices(emptyList())))))
        empty.table(AnalysisResourceKind.WIDE).rows.single()[AnalysisPhysicalNames.optionColumn("choices", "a")] shouldBe JsonPrimitive(false)
        val answer = empty.table(AnalysisResourceKind.LONG).rows.single()
        answer["value_kind"] shouldBe JsonPrimitive("EMPTY_SELECTION")
        answer["selection_count"] shouldBe JsonPrimitive(0)
        answer["option_id"] shouldBe JsonNull
        answer["option_metadata_hash"] shouldBe JsonNull
    }

    test("historical definitions distinguish absent fields and unavailable options") {
        val current = projectionContract()
        val oldDefinition = current.definition.copy(fields = current.definition.fields.filterNot { it.fieldId == "reason" }.map {
            if (it.fieldId == "choices") it.copy(optionIds = listOf("a", "b")) else it
        })
        val old = current.copy(definition = oldDefinition, flow = projectionFlow(oldDefinition))
        val fixture = ProjectionFixture(contracts = listOf(old, current))
        val result = fixture.project(listOf(fixture.row(contract = old, answers = mapOf("choices" to AnalysisStructuredValue.Choices(listOf("a"))))))
        val row = result.table(AnalysisResourceKind.WIDE).rows.single()
        row[AnalysisPhysicalNames.fieldColumn("reason", "applicable")] shouldBe JsonPrimitive(false)
        row[AnalysisPhysicalNames.optionColumn("choices", "a")] shouldBe JsonPrimitive(true)
        row[AnalysisPhysicalNames.optionColumn("choices", "b")] shouldBe JsonPrimitive(false)
        row[AnalysisPhysicalNames.optionColumn("choices", "c")] shouldBe JsonNull
    }

    test("only selected fields and dimensions reach scalar schema columns") {
        val fixture = ProjectionFixture(selected = listOf("score"), dimensions = emptyList(), hour = false)
        val result = fixture.project(listOf(fixture.row(answers = mapOf(
            "score" to AnalysisStructuredValue.Rating(3),
            "reason" to AnalysisStructuredValue.Choice("unselected-canary"),
        )).copy(dimensions = mapOf("deviceType" to "unselected-device-canary", "path" to "private-path-canary"))))
        result.tables.forEach { table ->
            table.rows.forEach { row ->
                row.keys shouldBe table.schema.columns.map { it.name }.toSet()
                row.values.all { it is JsonPrimitive } shouldBe true
            }
        }
        val serialized = result.tables.flatMap { it.rows }.toString()
        listOf("canary", "private-ref", "submitted_hour").forEach { serialized.contains(it) shouldBe false }
        result.table(AnalysisResourceKind.LONG).rows.single()["field_id"] shouldBe JsonPrimitive("score")
    }

    test("population-only scope has wide rows without exporting any answer") {
        val fixture = ProjectionFixture(selected = emptyList(), dimensions = emptyList())
        val result = fixture.project(listOf(fixture.row()))
        result.table(AnalysisResourceKind.WIDE).rows.size shouldBe 1
        result.table(AnalysisResourceKind.LONG).rows shouldBe emptyList()
        result.table(AnalysisResourceKind.FIELD_CATALOG).rows shouldBe emptyList()
    }

    test("team app survey and source window exclude unrelated rows before reading their contracts") {
        val fixture = ProjectionFixture()
        val row = fixture.row()
        val unrelated = listOf(row.copy(team = "other"), row.copy(app = "other"), row.copy(surveyId = "other"),
            row.copy(storedAt = fixture.context.sourceRetentionStart.minusNanos(1)),
            row.copy(storedAt = fixture.context.sourceSnapshotAt.plusNanos(1))).map { it.copy(definitionHash = null, flowHash = null) }
        fixture.project(unrelated + row).table(AnalysisResourceKind.WIDE).rows.size shouldBe 1
    }

    test("shorter product retention and paused cutoff use precise inclusive boundaries") {
        val fixture = ProjectionFixture(retention = AnalysisProductRetention.DAYS_30)
        val lower = fixture.context.sourceSnapshotAt.minusSeconds(30 * 86400)
        val cutoff = fixture.context.sourceSnapshotAt.minusSeconds(86400)
        val scope = fixture.scope(pausedAt = cutoff)
        val rows = listOf(lower.minusNanos(1), lower, cutoff, cutoff.plusNanos(1)).mapIndexed { index, instant ->
            fixture.row(ref = "private-ref-$index").copy(storedAt = instant)
        }
        fixture.project(rows, scope).table(AnalysisResourceKind.WIDE).rows.size shouldBe 2
    }

    test("server time yields Oslo day and UTC hour across daylight saving boundary") {
        val fixture = ProjectionFixture()
        val rows = listOf("2026-03-28T23:59:59Z", "2026-03-29T01:30:59Z", "2026-03-29T22:30:59Z").mapIndexed { index, instant ->
            fixture.row(ref = "private-ref-$index").copy(storedAt = Instant.parse(instant))
        }
        val projected = fixture.project(rows).table(AnalysisResourceKind.WIDE).rows
        projected.map { it["submitted_date"]!!.jsonPrimitive.content } shouldBe listOf("2026-03-29", "2026-03-29", "2026-03-30")
        projected.map { it["submitted_hour"]!!.jsonPrimitive.content } shouldBe listOf("2026-03-28T23:00:00Z", "2026-03-29T01:00:00Z", "2026-03-29T22:00:00Z")
    }

    test("unknown or missing pins and missing exact contracts reject the whole candidate") {
        val fixture = ProjectionFixture()
        listOf(fixture.row().copy(definitionHash = null), fixture.row().copy(flowHash = null),
            fixture.row().copy(definitionHash = "a".repeat(64)), fixture.row().copy(flowHash = "b".repeat(64))).forEach { invalid ->
            shouldThrow<IllegalStateException> { fixture.project(listOf(invalid)) }
        }
        shouldThrow<IllegalStateException> {
            AnalysisFlatProjector().project(fixture.scope(), fixture.context, listOf(fixture.row()), emptyList(), fixture.keys)
        }
    }

    test("invalid rating choice cardinality and selected dimension values reject the candidate") {
        val fixture = ProjectionFixture()
        val invalidAnswers = listOf(
            mapOf("score" to AnalysisStructuredValue.Rating(-1)), mapOf("score" to AnalysisStructuredValue.Rating(11)),
            mapOf("score" to AnalysisStructuredValue.Choice("a")), mapOf("reason" to AnalysisStructuredValue.Choice("unknown")),
            mapOf("choices" to AnalysisStructuredValue.Choices(listOf("a", "a"))),
            mapOf("choices" to AnalysisStructuredValue.Choices(listOf("a", "b", "c"))),
        )
        invalidAnswers.forEach { shouldThrow<IllegalArgumentException> { fixture.project(listOf(fixture.row(answers = it))) } }
        shouldThrow<IllegalArgumentException> { fixture.project(listOf(fixture.row().copy(dimensions = mapOf("deviceType" to "unknown")))) }
    }

    test("duplicate source references and adapter key collisions fail closed") {
        val fixture = ProjectionFixture()
        shouldThrow<IllegalArgumentException> { fixture.project(listOf(fixture.row(), fixture.row())) }
        val collisions = object : AnalysisProjectionKeys {
            override fun responseKey(productId: String, snapshotRowRef: String) = "same-response"
            override fun answerKey(productId: String, snapshotRowRef: String, fieldId: String) = "same-answer"
        }
        shouldThrow<IllegalArgumentException> {
            AnalysisFlatProjector().project(fixture.scope(), fixture.context, listOf(fixture.row()), fixture.contracts, collisions)
        }
        shouldThrow<IllegalArgumentException> {
            AnalysisFlatProjector().project(fixture.scope(), fixture.context,
                listOf(fixture.row(answers = emptyMap()), fixture.row("other", answers = emptyMap())), fixture.contracts, collisions)
        }
    }

    test("empty candidate still has structural fallback catalog and no fabricated observations") {
        val fixture = ProjectionFixture()
        val result = fixture.project(emptyList())
        result.table(AnalysisResourceKind.WIDE).rows shouldBe emptyList()
        result.table(AnalysisResourceKind.LONG).rows shouldBe emptyList()
        val catalog = result.table(AnalysisResourceKind.FIELD_CATALOG).rows
        catalog.size shouldBe 8
        catalog.all { it["first_observed_date"] == JsonNull && it["last_observed_date"] == JsonNull } shouldBe true
    }

    test("input ordering does not alter tables and product identity is passed to the key adapter") {
        val fixture = ProjectionFixture()
        val rows = listOf(fixture.row("a"), fixture.row("b"))
        fixture.project(rows) shouldBe fixture.project(rows.reversed())
        val second = ProjectionFixture(productId = "00000000-0000-0000-0000-000000000002")
        fixture.project(rows).table(AnalysisResourceKind.WIDE).rows.first()["response_key"] shouldNotBe
            second.project(rows).table(AnalysisResourceKind.WIDE).rows.first()["response_key"]
    }

    test("in-memory input budget and subtractive rebuild boundary are enforced") {
        val fixture = ProjectionFixture()
        shouldThrow<IllegalArgumentException> { fixture.project(List(AnalysisFlatProjector.MAX_SUBMISSIONS + 1) { fixture.row() }) }
        shouldThrow<IllegalArgumentException> { fixture.project(emptyList(), fixture.scope().copy(upperAllowlistRelease = 2)) }
    }

    test("expanded output budget rejects a small input with too many cells") {
        val fixture = ProjectionFixture()
        shouldThrow<IllegalArgumentException> {
            fixture.project(List(AnalysisFlatProjector.MAX_SUBMISSIONS) { fixture.row("private-ref-$it") })
        }.message shouldBe "candidate output budget exceeded"
    }

    listOf(
        Triple(SurveyFlowOperator.EQ, JsonPrimitive(0), true),
        Triple(SurveyFlowOperator.EQ, JsonPrimitive(1), false),
        Triple(SurveyFlowOperator.NEQ, JsonPrimitive(0), false),
        Triple(SurveyFlowOperator.NEQ, JsonPrimitive(1), true),
        Triple(SurveyFlowOperator.GT, JsonPrimitive(0), false),
        Triple(SurveyFlowOperator.LT, JsonPrimitive(1), true),
        Triple(SurveyFlowOperator.EXISTS, null, true),
    ).forEach { (operator, expected, applicable) ->
        test("pinned numeric predicate $operator $expected evaluates to $applicable") {
            val contract = projectionContract().withCondition("reason", SurveyFlowCondition(SurveyFlowConditionSource.ANSWER, "score", operator, expected))
            val fixture = ProjectionFixture(contracts = listOf(contract))
            val result = fixture.project(listOf(fixture.row(answers = mapOf("score" to AnalysisStructuredValue.Rating(0)))))
            result.table(AnalysisResourceKind.WIDE).rows.single()[AnalysisPhysicalNames.fieldColumn("reason", "applicable")] shouldBe JsonPrimitive(applicable)
            if (!applicable) shouldThrow<IllegalArgumentException> { fixture.project(listOf(fixture.row())) }
        }
    }

    test("missing numeric answer has EXISTS false and NEQ true without treating missing as zero") {
        listOf(SurveyFlowOperator.EXISTS to false, SurveyFlowOperator.NEQ to true).forEach { (operator, expected) ->
            val contract = projectionContract().withCondition("reason", SurveyFlowCondition(SurveyFlowConditionSource.ANSWER, "score", operator,
                if (operator == SurveyFlowOperator.EXISTS) null else JsonPrimitive(0)))
            val fixture = ProjectionFixture(contracts = listOf(contract))
            fixture.project(listOf(fixture.row(answers = emptyMap()))).table(AnalysisResourceKind.WIDE).rows.single()[AnalysisPhysicalNames.fieldColumn("reason", "applicable")] shouldBe JsonPrimitive(expected)
        }
    }

    test("ALL and ANY combine selected answer and metadata predicates with strict string equality") {
        SurveyFlowCombinator.entries.forEach { combinator ->
            val contract = projectionContract().withCondition("choices",
                SurveyFlowCondition(SurveyFlowConditionSource.ANSWER, "reason", SurveyFlowOperator.EQ, JsonPrimitive("no")),
                SurveyFlowCondition(SurveyFlowConditionSource.METADATA, "deviceType", SurveyFlowOperator.CONTAINS, JsonPrimitive("DESK")),
                combinator = combinator)
            val fixture = ProjectionFixture(contracts = listOf(contract))
            val row = fixture.row(answers = mapOf("reason" to AnalysisStructuredValue.Choice("yes")))
            fixture.project(listOf(row)).table(AnalysisResourceKind.WIDE).rows.single()[AnalysisPhysicalNames.fieldColumn("choices", "applicable")] shouldBe
                JsonPrimitive(combinator == SurveyFlowCombinator.ANY)
        }
    }

    test("multi-choice CONTAINS uses option membership while an empty list still EXISTS") {
        val initial = projectionContract()
        val definition = initial.definition.copy(fields = initial.definition.fields.sortedBy { if (it.fieldId == "choices") 0 else 1 })
        listOf(SurveyFlowOperator.CONTAINS to false, SurveyFlowOperator.EXISTS to true).forEach { (operator, expected) ->
            val contract = initial.copy(definition = definition, flow = projectionFlow(definition)).withCondition("reason",
                SurveyFlowCondition(SurveyFlowConditionSource.ANSWER, "choices", operator, if (operator == SurveyFlowOperator.CONTAINS) JsonPrimitive("a") else null))
            val fixture = ProjectionFixture(contracts = listOf(contract))
            fixture.project(listOf(fixture.row(answers = mapOf("choices" to AnalysisStructuredValue.Choices(emptyList())))))
                .table(AnalysisResourceKind.WIDE).rows.single()[AnalysisPhysicalNames.fieldColumn("reason", "applicable")] shouldBe JsonPrimitive(expected)
        }
    }

    test("a different predicate under an otherwise matching definition cannot replace the pinned flow") {
        val fixture = ProjectionFixture()
        val forged = projectionContract().withCondition("reason", SurveyFlowCondition(SurveyFlowConditionSource.ANSWER, "score", SurveyFlowOperator.GT, JsonPrimitive(5)))
        shouldThrow<IllegalStateException> {
            AnalysisFlatProjector().project(fixture.scope(), fixture.context, listOf(fixture.row()), listOf(forged), fixture.keys)
        }
        shouldThrow<IllegalStateException> {
            AnalysisFlatProjector().project(fixture.scope(), fixture.context, listOf(fixture.row()), fixture.contracts + fixture.contracts, fixture.keys)
        }
    }

    test("source contract must match the pinned option order as well as option membership") {
        val fixture = ProjectionFixture()
        val scope = fixture.scope()
        val inconsistent = scope.copy(sources = scope.sources.map { source -> source.copy(definitions = source.definitions.map { definition ->
            definition.copy(fields = definition.fields.map { field ->
                if (field.fieldId == "choices") field.copy(availableOptionIds = field.availableOptionIds.reversed()) else field
            })
        }) })
        shouldThrow<IllegalArgumentException> { fixture.project(listOf(fixture.row()), inconsistent) }.message shouldBe "field pin mismatch"
    }
})

private class ProjectionFixture(
    val contracts: List<AnalysisProjectionContract> = listOf(projectionContract()),
    val selected: List<String> = listOf("score", "reason", "choices"),
    val dimensions: List<String> = listOf("deviceType"),
    val hour: Boolean = true,
    val retention: AnalysisProductRetention = AnalysisProductRetention.SOURCE_MAXIMUM,
    val productId: String = "00000000-0000-0000-0000-000000000001",
) {
    val context = AnalysisProjectionContext("synthetic-candidate", Instant.parse("2026-09-09T12:00:00Z"), Instant.parse("2026-01-01T00:00:00Z"))
    // Synthetic adapter only: not a production derivation or security guarantee.
    val keys = object : AnalysisProjectionKeys {
        override fun responseKey(productId: String, snapshotRowRef: String) = AnalysisCanonicalHash.digest("synthetic-response", listOf(productId, snapshotRowRef))
        override fun answerKey(productId: String, snapshotRowRef: String, fieldId: String) = AnalysisCanonicalHash.digest("synthetic-answer", listOf(productId, snapshotRowRef, fieldId))
    }

    fun scope(pausedAt: Instant? = null): EffectivePublicationSpecification {
        fun fields(contract: AnalysisProjectionContract) = contract.definition.fields.map { field ->
            AnalysisCatalogFieldV1(field.fieldId, field.fieldType, field.ratingVariant, field.ratingScale,
                field.optionIds, maxSelections = field.maxSelections, label = null, labelSource = AnalysisLabelSource.UNKNOWN,
                flowDependencies = contract.flow.fields.single { it.fieldId == field.fieldId }.visibleIf?.conditions.orEmpty()
                    .map { AnalysisFlowDependencyV1(AnalysisFlowDependencySource.valueOf(it.source.name), it.key) }.distinct())
        }
        val latest = contracts.last()
        val source = AnalysisCatalogSourceV1(
            app = "app", surveyId = "survey", surveyType = SurveyType.CUSTOM, archived = false,
            definitionHash = latest.definition.computeHash(), definitionStatus = AnalysisDefinitionStatus.REGISTERED,
            observedDefinitionHashes = contracts.map { it.definition.computeHash() }.distinct(),
            flowHash = latest.flow.computeHash(), flowStatus = AnalysisFlowStatus.PINNED,
            flowHashes = contracts.map { it.flow.computeHash() }.distinct(), observedFlowHashes = contracts.map { it.flow.computeHash() }.distinct(),
            fields = fields(latest), warnings = emptyList(),
            contractRevisions = contracts.map { contract ->
                AnalysisCatalogContractRevision(contract.definition.computeHash(), contract.flow.computeHash(), SurveyType.CUSTOM,
                    fields(contract), SURVEY_FLOW_EVALUATOR_VERSION, fields(contract).map { AnalysisFieldDependenciesV1(it.fieldId, it.flowDependencies) })
            },
        )
        val registry = AnalysisDimensionRegistry.snapshot()
        val catalog = AnalysisSourceCatalogV1(team = "team", catalogRevision = AnalysisCatalogRevision.compute("team", listOf(source), registry), sources = listOf(source), dimensions = registry.dimensions)
        val document = AnalysisProductDocumentV1(name = "Synthetic", purpose = "Flat contract rehearsal", dataOwner = "owner", technicalOwner = "owner",
            useCases = listOf(AnalysisProductUseCase.METABASE), retention = retention, reviewDate = "2027-01-01",
            sources = listOf(AnalysisProductSourceSelection("app", "survey", selected)), dimensionKeys = dimensions, includeSubmittedHour = hour)
        val preview = AnalysisContractCompiler().compilePreview(AnalysisProductCompilationInput(productId, "team", "draft", 1, "a".repeat(64), document, catalog, registry))
        check(preview.status == AnalysisContractPreviewStatus.READY) { preview.issues.toString() }
        val specification = checkNotNull(preview.publicationSpecification)
        val release = AnalysisPublicationReleaseV2(1, specification, checkNotNull(preview.publicationSpecificationDigest))
        val plan = AnalysisEffectivePublicationPlanResolver.resolve(AnalysisPublicationControlState(productId, "team",
            if (pausedAt == null) AnalysisProductLifecycleState.ENABLED else AnalysisProductLifecycleState.PAUSED, 1, null, pausedAt), listOf(release))
        return when (plan) {
            is AnalysisPublicationPlan.Enabled -> plan.maintainedTarget
            is AnalysisPublicationPlan.Paused -> plan.maintainedTarget
            else -> error("unexpected synthetic plan")
        }
    }

    fun row(ref: String = "private-ref", contract: AnalysisProjectionContract = contracts.last(), answers: Map<String, AnalysisStructuredValue> = mapOf(
        "score" to AnalysisStructuredValue.Rating(0), "reason" to AnalysisStructuredValue.Choice("yes"), "choices" to AnalysisStructuredValue.Choices(listOf("b", "a")),
    )) = AnalysisProjectionSubmission(ref, "team", "app", "survey", Instant.parse("2026-09-01T12:00:00Z"), contract.definition.computeHash(), contract.flow.computeHash(), answers, mapOf("deviceType" to "desktop"))

    fun project(rows: List<AnalysisProjectionSubmission>, scope: EffectivePublicationSpecification = scope()) =
        AnalysisFlatProjector().project(scope, context, rows, contracts, keys)
}

private fun projectionContract(): AnalysisProjectionContract {
    val definition = SurveyDefinition("survey", SurveyType.CUSTOM, listOf(
        FieldDefinition("score", FieldType.RATING, RatingVariant.NPS, 11, null),
        FieldDefinition("reason", FieldType.SINGLE_CHOICE, null, null, listOf("yes", "no")),
        FieldDefinition("choices", FieldType.MULTI_CHOICE, null, null, listOf("a", "b", "c"), 2),
    ))
    return AnalysisProjectionContract("team", "app", definition, projectionFlow(definition))
}

private fun projectionFlow(definition: SurveyDefinition) = SurveyFlowDefinitionV1(1, SURVEY_FLOW_EVALUATOR_VERSION,
    definition.fields.map { SurveyFlowFieldDefinition(it.fieldId) })

private fun AnalysisProjectionContract.withCondition(fieldId: String, vararg conditions: SurveyFlowCondition,
    combinator: SurveyFlowCombinator = SurveyFlowCombinator.ALL) = copy(flow = flow.copy(fields = flow.fields.map {
        if (it.fieldId == fieldId) it.copy(visibleIf = SurveyVisibleIfDefinition(combinator, conditions.toList())) else it
    }))

private fun AnalysisFlatCandidate.table(kind: AnalysisResourceKind) = tables.single { it.schema.kind == kind }
