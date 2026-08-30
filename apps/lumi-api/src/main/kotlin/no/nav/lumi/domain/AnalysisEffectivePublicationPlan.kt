package no.nav.lumi.domain

import java.time.Instant

enum class EffectivePublicationLifecycleMode {
    ACTIVE,
    PAUSED,
}

enum class EffectiveFieldMode {
    INCLUDED,
    NULL_ONLY,
}

data class AnalysisPublicationControlState(
    val productId: String,
    val team: String,
    val lifecycleState: AnalysisProductLifecycleState,
    val activeReleaseNumber: Long?,
    val desiredReleaseNumber: Long?,
    val dataCutoffAt: Instant?,
)

data class AnalysisPublicationReleaseV2(
    val releaseNumber: Long,
    val specification: AnalysisPublicationSpecificationV2,
    val specificationDigest: String,
)

sealed interface AnalysisPublicationPlan {
    data class Enabled(
        val maintainedTarget: EffectivePublicationSpecification,
        val candidate: EffectivePublicationSpecification?,
    ) : AnalysisPublicationPlan

    data class Paused(
        val maintainedTarget: EffectivePublicationSpecification,
    ) : AnalysisPublicationPlan

    data class Offboarding(
        val productId: String,
        val team: String,
    ) : AnalysisPublicationPlan

    data object None : AnalysisPublicationPlan
}

/**
 * Digest for the complete resolver result, separate from each effective
 * specification digest. This is the idempotency boundary for immutable
 * control-plane generations.
 */
internal object AnalysisPublicationPlanDigests {
    fun digest(
        state: AnalysisPublicationControlState,
        plan: AnalysisPublicationPlan,
    ): String = AnalysisCanonicalHash.digest(
        domain = "analysis-effective-publication-plan-v1",
        parts = buildList {
            add(state.productId)
            add(state.team)
            add(state.lifecycleState.name)
            add(state.activeReleaseNumber?.toString() ?: "<null>")
            add(state.desiredReleaseNumber?.toString() ?: "<null>")
            add(state.dataCutoffAt?.toEpochMicroseconds()?.toString() ?: "<null>")
            when (plan) {
                is AnalysisPublicationPlan.Enabled -> {
                    add("ENABLED")
                    add(plan.maintainedTarget.effectiveSpecificationDigest)
                    add(plan.candidate?.effectiveSpecificationDigest ?: "<null>")
                }

                is AnalysisPublicationPlan.Paused -> {
                    add("PAUSED")
                    add(plan.maintainedTarget.effectiveSpecificationDigest)
                }

                is AnalysisPublicationPlan.Offboarding -> add("OFFBOARDING")
                AnalysisPublicationPlan.None -> add("NONE")
            }
        },
    )
}

data class EffectivePublicationSpecification(
    val productId: String,
    val team: String,
    val targetRelease: Long,
    val upperAllowlistRelease: Long,
    val lifecycleMode: EffectivePublicationLifecycleMode,
    val retention: AnalysisProductRetention,
    val dataCutoffAt: Instant?,
    val submittedHourMode: EffectiveFieldMode,
    val sources: List<EffectiveSourceProjection>,
    val dimensions: List<EffectiveDimensionProjection>,
    val resources: List<AnalysisResourceSchemaV1>,
    val effectiveSpecificationDigest: String,
    val effectiveSchemaDigest: String,
)

data class EffectiveSourceProjection(
    val app: String,
    val surveyId: String,
    val surveyType: SurveyType,
    val membershipAllowed: Boolean,
    val fields: List<EffectiveFieldProjection>,
    val definitions: List<AnalysisDefinitionPinV1>,
)

data class EffectiveFieldProjection(
    val fieldId: String,
    val mode: EffectiveFieldMode,
)

data class EffectiveDimensionProjection(
    val definition: AnalysisDimensionDefinitionV1,
    val mode: EffectiveFieldMode,
)

object AnalysisEffectivePublicationPlanResolver {
    private val sha256Pattern = Regex("^[0-9a-f]{64}$")

    fun resolve(
        state: AnalysisPublicationControlState,
        releases: List<AnalysisPublicationReleaseV2>,
    ): AnalysisPublicationPlan {
        val releasesByNumber = releases.associateBy { it.releaseNumber }
        require(releasesByNumber.size == releases.size) { "release numbers must be unique" }
        return when (state.lifecycleState) {
            AnalysisProductLifecycleState.DRAFT,
            AnalysisProductLifecycleState.DELETED,
            -> AnalysisPublicationPlan.None

            AnalysisProductLifecycleState.OFFBOARDING ->
                AnalysisPublicationPlan.Offboarding(state.productId, state.team)

            AnalysisProductLifecycleState.ENABLED -> {
                val active = requireRelease(state, releasesByNumber, requireNotNull(state.activeReleaseNumber) {
                    "enabled product must have an active release"
                })
                val upper = resolveUpperAllowlist(state, active, releasesByNumber)
                val maintained = compileEffective(
                    state = state,
                    target = active,
                    upper = upper,
                    lifecycleMode = EffectivePublicationLifecycleMode.ACTIVE,
                    dataCutoffAt = null,
                )
                val candidate = upper.takeIf { it.releaseNumber != active.releaseNumber }?.let { desired ->
                    compileEffective(
                        state = state,
                        target = desired,
                        upper = desired,
                        lifecycleMode = EffectivePublicationLifecycleMode.ACTIVE,
                        dataCutoffAt = null,
                    )
                }
                AnalysisPublicationPlan.Enabled(maintained, candidate)
            }

            AnalysisProductLifecycleState.PAUSED -> {
                val active = requireRelease(state, releasesByNumber, requireNotNull(state.activeReleaseNumber) {
                    "paused product must have an active release"
                })
                val cutoff = requireNotNull(state.dataCutoffAt) { "paused product must have a data cutoff" }
                require(cutoff.nano % 1_000 == 0) { "data cutoff must use PostgreSQL microsecond precision" }
                val upper = resolveUpperAllowlist(state, active, releasesByNumber)
                AnalysisPublicationPlan.Paused(
                    compileEffective(
                        state = state,
                        target = active,
                        upper = upper,
                        lifecycleMode = EffectivePublicationLifecycleMode.PAUSED,
                        dataCutoffAt = cutoff,
                    ),
                )
            }
        }
    }

    private fun resolveUpperAllowlist(
        state: AnalysisPublicationControlState,
        active: AnalysisPublicationReleaseV2,
        releases: Map<Long, AnalysisPublicationReleaseV2>,
    ): AnalysisPublicationReleaseV2 {
        val desiredNumber = state.desiredReleaseNumber ?: return active
        require(desiredNumber >= active.releaseNumber) {
            "an older desired release cannot expand the active security allowlist"
        }
        return requireRelease(state, releases, desiredNumber)
    }

    private fun requireRelease(
        state: AnalysisPublicationControlState,
        releases: Map<Long, AnalysisPublicationReleaseV2>,
        releaseNumber: Long,
    ): AnalysisPublicationReleaseV2 {
        require(releaseNumber > 0) { "release number must be positive" }
        val release = requireNotNull(releases[releaseNumber]) { "referenced release is unavailable" }
        validateSpecification(release.specification)
        require(release.specification.productId == state.productId) { "release product does not match control state" }
        require(release.specification.team == state.team) { "release team does not match control state" }
        require(release.specificationDigest.matches(sha256Pattern)) { "release digest is malformed" }
        require(
            release.specificationDigest == AnalysisPublicationSpecificationDigests.specification(release.specification),
        ) { "release digest does not match the publication specification" }
        return release
    }

    private fun validateSpecification(specification: AnalysisPublicationSpecificationV2) {
        require(specification.schemaVersion == 2) { "only publication specification V2 is exportable" }
        require(specification.compilerVersion == ANALYSIS_CONTRACT_COMPILER_VERSION) {
            "publication compiler version is unsupported"
        }
        require(specification.canonicalizationVersion == "length-prefixed-v2") {
            "publication canonicalization version is unsupported"
        }
        require(specification.contractVersion == ANALYSIS_CONTRACT_VERSION) {
            "public contract version is unsupported"
        }
        require(specification.productId.isNotBlank() && specification.team.isNotBlank()) {
            "publication provenance is malformed"
        }
        require(specification.catalogRevision.isNotBlank()) { "catalog revision is malformed" }
        require(specification.baseSchemaDigest.matches(sha256Pattern)) { "base schema digest is malformed" }
        require(specification.excludedDataCategories == ANALYSIS_EXCLUDED_DATA_CATEGORIES_V1) {
            "excluded data categories do not match the compiler policy"
        }

        val dimensionKeys = specification.dimensions.map { it.key }
        require(specification.dimensions.size <= 50) { "publication has too many dimensions" }
        require(dimensionKeys.distinct().size == dimensionKeys.size) { "publication has duplicate dimensions" }
        require(specification.dimensions.map { it.outputId }.distinct().size == specification.dimensions.size) {
            "publication has duplicate dimension outputs"
        }
        val registeredDimensions = AnalysisDimensionRegistry.snapshot().dimensions.associateBy { it.key }
        require(specification.dimensions.all { dimension -> registeredDimensions[dimension.key] == dimension }) {
            "publication contains a dimension outside the compiler registry"
        }

        val sourceKeys = specification.sources.map { it.app to it.surveyId }
        require(specification.sources.size <= 100) { "publication has too many sources" }
        require(sourceKeys.distinct().size == sourceKeys.size) { "publication has duplicate sources" }
        specification.sources.forEach { source -> validateSourcePin(source, dimensionKeys.toSet()) }

        require(specification.resources.map { it.name }.distinct().size == specification.resources.size) {
            "publication has duplicate resources"
        }
        specification.resources.forEach { resource ->
            require(resource.name.isNotBlank() && resource.rowMeaning.isNotBlank()) {
                "publication resource is malformed"
            }
            require(resource.syntheticRows.isEmpty()) { "publication resources cannot contain preview rows" }
            require(resource.columns.map { it.logicalId }.distinct().size == resource.columns.size) {
                "publication resource has duplicate logical columns"
            }
            require(resource.columns.map { it.name }.distinct().size == resource.columns.size) {
                "publication resource has duplicate physical columns"
            }
        }
        val expectedResources = AnalysisPublicationResourceCompilerV2.compile(
            sources = specification.sources,
            dimensions = specification.dimensions,
            includeSubmittedHour = specification.includeSubmittedHour,
        )
        require(specification.resources == expectedResources) {
            "publication resources do not match the V2 compiler output"
        }
        require(
            specification.baseSchemaDigest == AnalysisPublicationSpecificationDigests.schema(expectedResources),
        ) { "base schema digest does not match publication resources" }
    }

    private fun validateSourcePin(source: AnalysisSourcePinV2, selectedDimensionKeys: Set<String>) {
        require(source.app.isNotBlank() && source.surveyId.isNotBlank()) { "publication source is malformed" }
        require(source.app.length <= 255 && source.surveyId.length <= 255) { "publication source identity is too long" }
        require(source.selectedFieldIds.all { it.isNotBlank() }) { "publication has a malformed field ID" }
        require(source.selectedFieldIds.all { it.length <= 200 }) { "publication field ID is too long" }
        require(source.selectedFieldIds.size <= 500) { "publication source has too many selected fields" }
        require(source.selectedFieldIds.distinct().size == source.selectedFieldIds.size) {
            "publication source has duplicate selected fields"
        }
        require(source.definitions.isNotEmpty()) { "publication source has no exact contract revisions" }
        require(source.definitions.map { it.definitionHash }.distinct().size == source.definitions.size) {
            "publication source has duplicate definitions"
        }
        source.definitions.forEach { definition ->
            require(definition.definitionHash.matches(sha256Pattern)) { "definition hash is malformed" }
            require(definition.fields.map { it.fieldId }.distinct().size == definition.fields.size) {
                "publication definition has duplicate fields"
            }
            require(definition.fields.map { it.fieldId }.toSet() == source.selectedFieldIds.toSet()) {
                "publication definition does not declare every selected field"
            }
            definition.fields.forEach(::validateDefinitionField)
            val presentFieldIds = definition.fields
                .filter { it.presence == AnalysisFieldPresence.PRESENT }
                .map { it.fieldId }
                .toSet()
            require(definition.flows.isNotEmpty()) { "publication definition has no exact flow revisions" }
            require(definition.flows.map { it.flowHash }.distinct().size == definition.flows.size) {
                "publication definition has duplicate flows"
            }
            definition.flows.forEach { flow ->
                require(flow.flowHash.matches(sha256Pattern)) { "flow hash is malformed" }
                require(flow.evaluatorVersion == SURVEY_FLOW_EVALUATOR_VERSION) {
                    "flow evaluator version is unsupported"
                }
                require(flow.dependenciesByField.map { it.fieldId }.distinct().size == flow.dependenciesByField.size) {
                    "publication flow has duplicate dependency fields"
                }
                require(flow.dependenciesByField.map { it.fieldId }.toSet() == presentFieldIds) {
                    "publication flow dependencies do not match present fields"
                }
                flow.dependenciesByField.forEach { fieldDependencies ->
                    require(
                        fieldDependencies.dependencies.distinct().size == fieldDependencies.dependencies.size,
                    ) { "publication flow has duplicate dependencies" }
                    fieldDependencies.dependencies.forEach { dependency ->
                        require(dependency.key.isNotBlank()) { "publication flow dependency is malformed" }
                        require(
                            when (dependency.source) {
                                AnalysisFlowDependencySource.ANSWER -> dependency.key in presentFieldIds
                                AnalysisFlowDependencySource.METADATA -> dependency.key in selectedDimensionKeys
                            },
                        ) { "publication flow dependency is outside the selected scope" }
                    }
                }
            }
        }
        source.selectedFieldIds.forEach { fieldId ->
            val presentFields = source.definitions.map { definition ->
                definition.fields.single { it.fieldId == fieldId }
            }.filter { it.presence == AnalysisFieldPresence.PRESENT }
            require(presentFields.isNotEmpty()) {
                "selected publication field is absent from every definition"
            }
            require(
                presentFields.map { field ->
                    listOf(field.fieldType, field.ratingVariant, field.ratingScale, field.maxSelections)
                }.distinct().size == 1,
            ) { "selected publication field changes structural type" }
        }
    }

    private fun validateDefinitionField(field: AnalysisDefinitionFieldPinV1) {
        require(field.fieldId.isNotBlank()) { "publication field ID is malformed" }
        when (field.presence) {
            AnalysisFieldPresence.ABSENT -> require(
                field.fieldType == null &&
                    field.ratingVariant == null &&
                    field.ratingScale == null &&
                    field.maxSelections == null &&
                    field.availableOptionIds.isEmpty(),
            ) { "absent publication field contains structural data" }

            AnalysisFieldPresence.PRESENT -> when (field.fieldType) {
                FieldType.RATING -> require(
                    field.ratingVariant != null &&
                        field.ratingScale == RatingVariant.getScale(field.ratingVariant) &&
                        field.maxSelections == null &&
                        field.availableOptionIds.isEmpty(),
                ) { "rating publication field is malformed" }

                FieldType.SINGLE_CHOICE -> require(
                    field.ratingVariant == null &&
                        field.ratingScale == null &&
                        field.maxSelections == null &&
                        field.availableOptionIds.isNotEmpty() &&
                        field.availableOptionIds.distinct().size == field.availableOptionIds.size,
                ) { "single-choice publication field is malformed" }

                FieldType.MULTI_CHOICE -> require(
                    field.ratingVariant == null &&
                        field.ratingScale == null &&
                        field.availableOptionIds.isNotEmpty() &&
                        field.availableOptionIds.distinct().size == field.availableOptionIds.size &&
                        (field.maxSelections == null || field.maxSelections in 1..field.availableOptionIds.size),
                ) { "multi-choice publication field is malformed" }

                FieldType.TEXT, FieldType.DATE, null ->
                    throw IllegalArgumentException("publication field type is not exportable")
            }
        }
    }

    private fun compileEffective(
        state: AnalysisPublicationControlState,
        target: AnalysisPublicationReleaseV2,
        upper: AnalysisPublicationReleaseV2,
        lifecycleMode: EffectivePublicationLifecycleMode,
        dataCutoffAt: Instant?,
    ): EffectivePublicationSpecification {
        require(
            target.specification.sources.map { it.app to it.surveyId }.distinct().size ==
                target.specification.sources.size,
        ) { "target specification has duplicate sources" }
        val upperSources = upper.specification.sources.associateBy { it.app to it.surveyId }
        require(upperSources.size == upper.specification.sources.size) { "upper allowlist has duplicate sources" }
        val sources = target.specification.sources
            .sortedWith(compareBy(AnalysisSourcePinV2::app, AnalysisSourcePinV2::surveyId))
            .map { targetSource ->
                compileSourceProjection(targetSource, upperSources[targetSource.app to targetSource.surveyId])
            }
        require(target.specification.dimensions.map { it.key }.distinct().size == target.specification.dimensions.size) {
            "target specification has duplicate dimensions"
        }
        val upperDimensions = upper.specification.dimensions.associateBy { it.key }
        require(upperDimensions.size == upper.specification.dimensions.size) {
            "upper allowlist has duplicate dimensions"
        }
        val dimensions = target.specification.dimensions.sortedBy { it.key }.map { targetDimension ->
            val upperDimension = upperDimensions[targetDimension.key]
            if (upperDimension != null) {
                require(upperDimension == targetDimension) { "dimension identity changed without a new key" }
            }
            EffectiveDimensionProjection(
                definition = targetDimension,
                mode = if (upperDimension == null) EffectiveFieldMode.NULL_ONLY else EffectiveFieldMode.INCLUDED,
            )
        }
        val retention = minRetention(target.specification.retention, upper.specification.retention)
        val submittedHourMode = if (
            target.specification.includeSubmittedHour && upper.specification.includeSubmittedHour
        ) {
            EffectiveFieldMode.INCLUDED
        } else {
            EffectiveFieldMode.NULL_ONLY
        }
        val digest = digestEffective(
            state = state,
            target = target,
            upper = upper,
            lifecycleMode = lifecycleMode,
            retention = retention,
            dataCutoffAt = dataCutoffAt,
            submittedHourMode = submittedHourMode,
            sources = sources,
            dimensions = dimensions,
        )
        return EffectivePublicationSpecification(
            productId = state.productId,
            team = state.team,
            targetRelease = target.releaseNumber,
            upperAllowlistRelease = upper.releaseNumber,
            lifecycleMode = lifecycleMode,
            retention = retention,
            dataCutoffAt = dataCutoffAt,
            submittedHourMode = submittedHourMode,
            sources = sources,
            dimensions = dimensions,
            resources = target.specification.resources,
            effectiveSpecificationDigest = digest,
            effectiveSchemaDigest = target.specification.baseSchemaDigest,
        )
    }

    private fun compileSourceProjection(
        target: AnalysisSourcePinV2,
        upper: AnalysisSourcePinV2?,
    ): EffectiveSourceProjection {
        if (upper != null) {
            require(upper.surveyType == target.surveyType) { "survey type changed without a new source identity" }
        }
        require(target.selectedFieldIds.distinct().size == target.selectedFieldIds.size) {
            "target source has duplicate selected fields"
        }
        require(upper == null || upper.selectedFieldIds.distinct().size == upper.selectedFieldIds.size) {
            "upper source has duplicate selected fields"
        }
        val upperFieldIds = upper?.selectedFieldIds.orEmpty().toSet()
        val fields = target.selectedFieldIds.sorted().map { fieldId ->
            EffectiveFieldProjection(
                fieldId = fieldId,
                mode = if (fieldId in upperFieldIds) EffectiveFieldMode.INCLUDED else EffectiveFieldMode.NULL_ONLY,
            )
        }
        val includedFieldIds = fields.filter { it.mode == EffectiveFieldMode.INCLUDED }.map { it.fieldId }.toSet()
        require(target.definitions.map { it.definitionHash }.distinct().size == target.definitions.size) {
            "target source has duplicate definitions"
        }
        val upperDefinitions = upper?.definitions.orEmpty().associateBy { it.definitionHash }
        require(upperDefinitions.size == upper?.definitions.orEmpty().size) { "upper source has duplicate definitions" }
        val definitions = target.definitions.sortedBy { it.definitionHash }.mapNotNull { targetDefinition ->
            val upperDefinition = upperDefinitions[targetDefinition.definitionHash] ?: return@mapNotNull null
            compileDefinitionIntersection(targetDefinition, upperDefinition, includedFieldIds)
        }
        return EffectiveSourceProjection(
            app = target.app,
            surveyId = target.surveyId,
            surveyType = target.surveyType,
            membershipAllowed = definitions.any { it.flows.isNotEmpty() },
            fields = fields,
            definitions = definitions,
        )
    }

    private fun compileDefinitionIntersection(
        target: AnalysisDefinitionPinV1,
        upper: AnalysisDefinitionPinV1,
        includedFieldIds: Set<String>,
    ): AnalysisDefinitionPinV1 {
        require(target.fields.map { it.fieldId }.distinct().size == target.fields.size) {
            "target definition has duplicate fields"
        }
        require(target.flows.map { it.flowHash }.distinct().size == target.flows.size) {
            "target definition has duplicate flows"
        }
        val upperFields = upper.fields.associateBy { it.fieldId }
        require(upperFields.size == upper.fields.size) { "upper definition has duplicate fields" }
        val fields = target.fields
            .filter { it.fieldId in includedFieldIds }
            .sortedBy { it.fieldId }
            .map { targetField ->
                val upperField = requireNotNull(upperFields[targetField.fieldId]) {
                    "included field is absent from the upper definition contract"
                }
                require(upperField == targetField) { "field structure changed under the same definition hash" }
                targetField
            }
        val upperFlows = upper.flows.associateBy { it.flowHash }
        require(upperFlows.size == upper.flows.size) { "upper definition has duplicate flows" }
        val flows = target.flows.sortedBy { it.flowHash }.mapNotNull { targetFlow ->
            val upperFlow = upperFlows[targetFlow.flowHash] ?: return@mapNotNull null
            validateFlowDependencies(targetFlow, "target")
            validateFlowDependencies(upperFlow, "upper")
            require(upperFlow.evaluatorVersion == targetFlow.evaluatorVersion) {
                "evaluator changed under the same flow hash"
            }
            val targetDependencies = targetFlow.dependenciesByField
                .filter { it.fieldId in includedFieldIds }
                .sortedBy { it.fieldId }
                .map(::sortDependencies)
            val upperDependencies = upperFlow.dependenciesByField
                .filter { it.fieldId in includedFieldIds }
                .sortedBy { it.fieldId }
                .map(::sortDependencies)
            require(upperDependencies == targetDependencies) { "flow dependencies changed under the same flow hash" }
            targetFlow.copy(dependenciesByField = targetDependencies)
        }
        return AnalysisDefinitionPinV1(
            definitionHash = target.definitionHash,
            fields = fields,
            flows = flows,
        )
    }

    private fun validateFlowDependencies(flow: AnalysisFlowPinV1, scope: String) {
        require(flow.dependenciesByField.map { it.fieldId }.distinct().size == flow.dependenciesByField.size) {
            "$scope flow has duplicate dependency fields"
        }
        require(flow.dependenciesByField.all { field -> field.dependencies.distinct().size == field.dependencies.size }) {
            "$scope flow has duplicate dependencies"
        }
    }

    private fun sortDependencies(field: AnalysisFieldDependenciesV1): AnalysisFieldDependenciesV1 =
        field.copy(
            dependencies = field.dependencies.sortedWith(
                compareBy(AnalysisFlowDependencyV1::source, AnalysisFlowDependencyV1::key),
            ),
        )

    private fun minRetention(
        first: AnalysisProductRetention,
        second: AnalysisProductRetention,
    ): AnalysisProductRetention = listOf(first, second).minBy { retentionRank(it) }

    private fun retentionRank(retention: AnalysisProductRetention): Int = when (retention) {
        AnalysisProductRetention.DAYS_30 -> 30
        AnalysisProductRetention.DAYS_90 -> 90
        AnalysisProductRetention.DAYS_180 -> 180
        AnalysisProductRetention.SOURCE_MAXIMUM -> 365
    }

    private fun digestEffective(
        state: AnalysisPublicationControlState,
        target: AnalysisPublicationReleaseV2,
        upper: AnalysisPublicationReleaseV2,
        lifecycleMode: EffectivePublicationLifecycleMode,
        retention: AnalysisProductRetention,
        dataCutoffAt: Instant?,
        submittedHourMode: EffectiveFieldMode,
        sources: List<EffectiveSourceProjection>,
        dimensions: List<EffectiveDimensionProjection>,
    ): String = AnalysisCanonicalHash.digest(
        domain = "analysis-effective-publication-specification-v1",
        parts = buildList {
            add(state.productId)
            add(state.team)
            add(target.releaseNumber.toString())
            add(target.specificationDigest)
            add(upper.releaseNumber.toString())
            add(upper.specificationDigest)
            add(lifecycleMode.name)
            add(retention.name)
            add(dataCutoffAt?.toEpochMicroseconds()?.toString() ?: "<null>")
            add(submittedHourMode.name)
            sources.forEach { source ->
                add(source.app)
                add(source.surveyId)
                add(source.surveyType.name)
                add(source.membershipAllowed.toString())
                source.fields.forEach { field ->
                    add(field.fieldId)
                    add(field.mode.name)
                }
                source.definitions.forEach { definition ->
                    add(definition.definitionHash)
                    definition.fields.forEach { field ->
                        add(field.fieldId)
                        add(field.presence.name)
                        add(field.fieldType?.name ?: "<null>")
                        add(field.ratingVariant?.name ?: "<null>")
                        add(field.ratingScale?.toString() ?: "<null>")
                        add(field.maxSelections?.toString() ?: "<null>")
                        field.availableOptionIds.forEach(::add)
                    }
                    definition.flows.forEach { flow ->
                        add(flow.flowHash)
                        add(flow.evaluatorVersion)
                        flow.dependenciesByField.forEach { fieldDependencies ->
                            add(fieldDependencies.fieldId)
                            fieldDependencies.dependencies.forEach { dependency ->
                                add(dependency.source.name)
                                add(dependency.key)
                            }
                        }
                    }
                }
            }
            dimensions.forEach { dimension ->
                add(dimension.definition.key)
                add(dimension.definition.outputId)
                add(dimension.mode.name)
            }
            add(target.specification.baseSchemaDigest)
        },
    )
}

private fun Instant.toEpochMicroseconds(): Long =
    Math.addExact(Math.multiplyExact(epochSecond, 1_000_000), nano.toLong() / 1_000)
