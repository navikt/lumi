package no.nav.lumi.domain

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import java.time.Instant

class AnalysisEffectivePublicationPlanTest : FunSpec({
    test("desired release reduces the active scope immediately but additions stay in the candidate") {
        val active = release(
            number = 1,
            specification = specification(
                source("app", "survey", "score", "reason"),
                retention = AnalysisProductRetention.SOURCE_MAXIMUM,
            ),
        )
        val desired = release(
            number = 2,
            specification = specification(
                source("app", "survey", "score", "new-field"),
                retention = AnalysisProductRetention.DAYS_90,
            ),
        )

        val plan = AnalysisEffectivePublicationPlanResolver.resolve(
            controlState(
                lifecycle = AnalysisProductLifecycleState.ENABLED,
                activeRelease = 1,
                desiredRelease = 2,
            ),
            listOf(active, desired),
        ) as AnalysisPublicationPlan.Enabled

        plan.maintainedTarget.targetRelease shouldBe 1
        plan.maintainedTarget.upperAllowlistRelease shouldBe 2
        plan.maintainedTarget.retention shouldBe AnalysisProductRetention.DAYS_90
        plan.maintainedTarget.sources.single().fields.associate { it.fieldId to it.mode } shouldBe mapOf(
            "reason" to EffectiveFieldMode.NULL_ONLY,
            "score" to EffectiveFieldMode.INCLUDED,
        )
        plan.candidate?.targetRelease shouldBe 2
        plan.candidate?.sources?.single()?.fields?.map { it.fieldId } shouldBe listOf("new-field", "score")
    }

    test("submitted hour is reduced immediately but added only in the candidate") {
        val withHour = release(
            number = 1,
            specification = specification(
                source("app", "survey", "score"),
                includeSubmittedHour = true,
            ),
        )
        val withoutHour = release(
            number = 2,
            specification = specification(
                source("app", "survey", "score"),
                includeSubmittedHour = false,
            ),
        )

        val reduced = AnalysisEffectivePublicationPlanResolver.resolve(
            controlState(
                lifecycle = AnalysisProductLifecycleState.ENABLED,
                activeRelease = 1,
                desiredRelease = 2,
            ),
            listOf(withHour, withoutHour),
        ) as AnalysisPublicationPlan.Enabled
        reduced.maintainedTarget.submittedHourMode shouldBe EffectiveFieldMode.NULL_ONLY
        reduced.candidate?.submittedHourMode shouldBe EffectiveFieldMode.NULL_ONLY

        val added = AnalysisEffectivePublicationPlanResolver.resolve(
            controlState(
                lifecycle = AnalysisProductLifecycleState.ENABLED,
                activeRelease = 1,
                desiredRelease = 2,
            ),
            listOf(
                release(1, withoutHour.specification),
                release(2, withHour.specification),
            ),
        ) as AnalysisPublicationPlan.Enabled
        added.maintainedTarget.submittedHourMode shouldBe EffectiveFieldMode.NULL_ONLY
        added.candidate?.submittedHourMode shouldBe EffectiveFieldMode.INCLUDED
    }

    test("effective intersection removes an exact definition-flow pair without cross-combining revisions") {
        val baseSource = source("app", "survey", "score")
        val firstDefinition = baseSource.definitions.single().copy(
            definitionHash = "c".repeat(64),
            flows = listOf(baseSource.definitions.single().flows.single().copy(flowHash = "e".repeat(64))),
        )
        val secondDefinition = baseSource.definitions.single()
        val activeSource = baseSource.copy(definitions = listOf(firstDefinition, secondDefinition))
        val desiredSource = baseSource.copy(definitions = listOf(secondDefinition))

        val plan = AnalysisEffectivePublicationPlanResolver.resolve(
            controlState(
                lifecycle = AnalysisProductLifecycleState.ENABLED,
                activeRelease = 1,
                desiredRelease = 2,
            ),
            listOf(
                release(1, specification(activeSource)),
                release(2, specification(desiredSource)),
            ),
        ) as AnalysisPublicationPlan.Enabled

        plan.maintainedTarget.sources.single().definitions shouldBe listOf(secondDefinition)
        plan.candidate?.sources?.single()?.definitions shouldBe listOf(secondDefinition)
    }

    test("an older desired release cannot become the security upper allowlist") {
        val first = release(1, specification(source("app", "survey", "score")))
        val second = release(2, specification(source("app", "survey", "score", "reason")))

        shouldThrow<IllegalArgumentException> {
            AnalysisEffectivePublicationPlanResolver.resolve(
                controlState(
                    lifecycle = AnalysisProductLifecycleState.ENABLED,
                    activeRelease = 2,
                    desiredRelease = 1,
                ),
                listOf(first, second),
            )
        }
    }

    test("paused products freeze their upper cutoff while the shortest retention still applies") {
        val cutoff = Instant.parse("2026-08-29T12:00:00.123456Z")
        val active = release(
            1,
            specification(
                source("app", "survey", "score"),
                retention = AnalysisProductRetention.SOURCE_MAXIMUM,
            ),
        )
        val desired = release(
            2,
            specification(
                source("app", "survey", "score"),
                retention = AnalysisProductRetention.DAYS_30,
            ),
        )

        val plan = AnalysisEffectivePublicationPlanResolver.resolve(
            controlState(
                lifecycle = AnalysisProductLifecycleState.PAUSED,
                activeRelease = 1,
                desiredRelease = 2,
                dataCutoffAt = cutoff,
            ),
            listOf(active, desired),
        ) as AnalysisPublicationPlan.Paused

        plan.maintainedTarget.lifecycleMode shouldBe EffectivePublicationLifecycleMode.PAUSED
        plan.maintainedTarget.dataCutoffAt shouldBe cutoff
        plan.maintainedTarget.retention shouldBe AnalysisProductRetention.DAYS_30
    }

    test("paused products require an immutable microsecond cutoff") {
        val active = release(1, specification(source("app", "survey", "score")))

        shouldThrow<IllegalArgumentException> {
            AnalysisEffectivePublicationPlanResolver.resolve(
                controlState(
                    lifecycle = AnalysisProductLifecycleState.PAUSED,
                    activeRelease = 1,
                    dataCutoffAt = null,
                ),
                listOf(active),
            )
        }
        shouldThrow<IllegalArgumentException> {
            AnalysisEffectivePublicationPlanResolver.resolve(
                controlState(
                    lifecycle = AnalysisProductLifecycleState.PAUSED,
                    activeRelease = 1,
                    dataCutoffAt = Instant.parse("2026-08-29T12:00:00.123456789Z"),
                ),
                listOf(active),
            )
        }
    }

    test("offboarding and non-published lifecycle states expose no readable specification") {
        val release = release(1, specification(source("app", "survey", "score")))

        AnalysisEffectivePublicationPlanResolver.resolve(
            controlState(AnalysisProductLifecycleState.OFFBOARDING, activeRelease = 1),
            listOf(release),
        ) shouldBe AnalysisPublicationPlan.Offboarding(PRODUCT_ID, TEAM)
        AnalysisEffectivePublicationPlanResolver.resolve(
            controlState(AnalysisProductLifecycleState.DRAFT),
            listOf(release),
        ) shouldBe AnalysisPublicationPlan.None
        AnalysisEffectivePublicationPlanResolver.resolve(
            controlState(AnalysisProductLifecycleState.DELETED),
            listOf(release),
        ) shouldBe AnalysisPublicationPlan.None
    }

    test("effective digest is ordering independent and changes for a semantic reduction") {
        val first = specification(
            source("app-b", "survey", "score"),
            source("app-a", "survey", "score", "reason"),
        )
        val reordered = first.copy(sources = first.sources.reversed())
        val reduced = specification(
            source("app-b", "survey", "score"),
            source("app-a", "survey", "score"),
        )

        fun digest(target: AnalysisPublicationSpecificationV2, upper: AnalysisPublicationSpecificationV2): String {
            val plan = AnalysisEffectivePublicationPlanResolver.resolve(
                controlState(AnalysisProductLifecycleState.ENABLED, activeRelease = 1, desiredRelease = 2),
                listOf(release(1, target), release(2, upper)),
            ) as AnalysisPublicationPlan.Enabled
            return plan.maintainedTarget.effectiveSpecificationDigest
        }

        digest(first, first) shouldBe digest(reordered, reordered)
        (digest(first, first) == digest(first, reduced)) shouldBe false
    }

    test("PublicationSpecification V2 resource schema has a frozen golden digest") {
        val specification = specification(source("app", "survey", "score"))

        specification.resources.map { it.kind } shouldBe listOf(
            AnalysisResourceKind.WIDE,
            AnalysisResourceKind.LONG,
            AnalysisResourceKind.FIELD_CATALOG,
            AnalysisResourceKind.MANIFEST,
        )
        specification.baseSchemaDigest shouldBe "a1401b4f3fa504be4ba5e6734d0d5ea40ffef558a0933eee6e7c9b4069c20fc6"
    }

    test("release provenance must match the control-plane product and team") {
        val foreign = release(
            1,
            specification(source("app", "survey", "score")).copy(team = "team-b"),
        )

        shouldThrow<IllegalArgumentException> {
            AnalysisEffectivePublicationPlanResolver.resolve(
                controlState(AnalysisProductLifecycleState.ENABLED, activeRelease = 1),
                listOf(foreign),
            )
        }
    }

    test("duplicate flow dependencies fail closed") {
        val source = source("app", "survey", "score")
        val definition = source.definitions.single()
        val flow = definition.flows.single()
        val dependency = AnalysisFlowDependencyV1(AnalysisFlowDependencySource.METADATA, "deviceType")
        val malformedSource = source.copy(
            definitions = listOf(
                definition.copy(
                    flows = listOf(
                        flow.copy(
                            dependenciesByField = listOf(
                                AnalysisFieldDependenciesV1("score", listOf(dependency, dependency)),
                            ),
                        ),
                    ),
                ),
            ),
        )
        val malformed = release(1, specification(malformedSource))

        shouldThrow<IllegalArgumentException> {
            AnalysisEffectivePublicationPlanResolver.resolve(
                controlState(AnalysisProductLifecycleState.ENABLED, activeRelease = 1),
                listOf(malformed),
            )
        }
    }

    test("stored specification and schema digests are verified before scope resolution") {
        val valid = release(1, specification(source("app", "survey", "score")))
        val changedSpecification = valid.copy(
            specification = valid.specification.copy(retention = AnalysisProductRetention.DAYS_30),
        )
        val changedSchemaDigest = valid.specification.copy(baseSchemaDigest = "a".repeat(64)).let { specification ->
            release(1, specification)
        }

        listOf(changedSpecification, changedSchemaDigest).forEach { malformed ->
            shouldThrow<IllegalArgumentException> {
                AnalysisEffectivePublicationPlanResolver.resolve(
                    controlState(AnalysisProductLifecycleState.ENABLED, activeRelease = 1),
                    listOf(malformed),
                )
            }
        }
    }

    test("stored resources must be exact V2 compiler output even when both digests are recomputed") {
        val valid = specification(source("app", "survey", "score"))
        val wideIndex = valid.resources.indexOfFirst { it.kind == AnalysisResourceKind.WIDE }
        val wide = valid.resources[wideIndex]
        val injectedColumn = wide.columns.last().copy(
            logicalId = "field:not-selected:rating",
            name = "field_not_selected__rating",
            description = "Injected column.",
        )
        val changedResources = valid.resources.toMutableList().also { resources ->
            resources[wideIndex] = wide.copy(columns = wide.columns + injectedColumn)
        }
        val tamperedSpecification = valid.copy(
            resources = changedResources,
            baseSchemaDigest = AnalysisPublicationSpecificationDigests.schema(changedResources),
        )

        shouldThrow<IllegalArgumentException> {
            AnalysisEffectivePublicationPlanResolver.resolve(
                controlState(AnalysisProductLifecycleState.ENABLED, activeRelease = 1),
                listOf(release(1, tamperedSpecification)),
            )
        }
    }

    test("submitted-hour policy must match the derived resources") {
        val valid = specification(source("app", "survey", "score"))
        val tamperedSpecification = valid.copy(includeSubmittedHour = true)

        shouldThrow<IllegalArgumentException> {
            AnalysisEffectivePublicationPlanResolver.resolve(
                controlState(AnalysisProductLifecycleState.ENABLED, activeRelease = 1),
                listOf(release(1, tamperedSpecification)),
            )
        }
    }

    test("a selected field cannot be absent from every pinned definition") {
        val valid = specification(source("app", "survey", "score"))
        val source = valid.sources.single()
        val definition = source.definitions.single()
        val absentField = AnalysisDefinitionFieldPinV1(
            fieldId = "score",
            presence = AnalysisFieldPresence.ABSENT,
        )
        val tamperedSpecification = valid.copy(
            sources = listOf(
                source.copy(
                    definitions = listOf(
                        definition.copy(
                            fields = listOf(absentField),
                            flows = listOf(
                                definition.flows.single().copy(dependenciesByField = emptyList()),
                            ),
                        ),
                    ),
                ),
            ),
        )

        shouldThrow<IllegalArgumentException> {
            AnalysisEffectivePublicationPlanResolver.resolve(
                controlState(AnalysisProductLifecycleState.ENABLED, activeRelease = 1),
                listOf(release(1, tamperedSpecification)),
            )
        }
    }

    test("unsupported versions and structural data on absent fields fail closed") {
        val validSource = source("app", "survey", "score")
        val definition = validSource.definitions.single()
        val malformedField = definition.fields.single().copy(presence = AnalysisFieldPresence.ABSENT)
        val malformedSource = validSource.copy(
            definitions = listOf(definition.copy(fields = listOf(malformedField))),
        )
        val malformedStructure = release(
            1,
            specification(validSource).copy(sources = listOf(malformedSource)),
        )
        val unsupportedVersion = specification(validSource).copy(compilerVersion = "future-compiler").let { specification ->
            release(1, specification)
        }

        listOf(malformedStructure, unsupportedVersion).forEach { malformed ->
            shouldThrow<IllegalArgumentException> {
                AnalysisEffectivePublicationPlanResolver.resolve(
                    controlState(AnalysisProductLifecycleState.ENABLED, activeRelease = 1),
                    listOf(malformed),
                )
            }
        }
    }
})

private const val PRODUCT_ID = "00000000-0000-0000-0000-000000000001"
private const val TEAM = "team-a"

private fun controlState(
    lifecycle: AnalysisProductLifecycleState,
    activeRelease: Long? = null,
    desiredRelease: Long? = activeRelease,
    dataCutoffAt: Instant? = null,
) = AnalysisPublicationControlState(
    productId = PRODUCT_ID,
    team = TEAM,
    lifecycleState = lifecycle,
    activeReleaseNumber = activeRelease,
    desiredReleaseNumber = desiredRelease,
    dataCutoffAt = dataCutoffAt,
)

private fun release(
    number: Long,
    specification: AnalysisPublicationSpecificationV2,
) = AnalysisPublicationReleaseV2(
    releaseNumber = number,
    specification = specification,
    specificationDigest = AnalysisPublicationSpecificationDigests.specification(specification),
)

private fun specification(
    vararg sources: AnalysisSourcePinV2,
    retention: AnalysisProductRetention = AnalysisProductRetention.SOURCE_MAXIMUM,
    includeSubmittedHour: Boolean = false,
): AnalysisPublicationSpecificationV2 {
    val sourcePins = sources.toList()
    val resources = AnalysisPublicationResourceCompilerV2.compile(
        sources = sourcePins,
        dimensions = emptyList(),
        includeSubmittedHour = includeSubmittedHour,
    )
    return AnalysisPublicationSpecificationV2(
        productId = PRODUCT_ID,
        team = TEAM,
        retention = retention,
        includeSubmittedHour = includeSubmittedHour,
        catalogRevision = "catalog",
        sources = sourcePins,
        dimensions = emptyList(),
        resources = resources,
        excludedDataCategories = ANALYSIS_EXCLUDED_DATA_CATEGORIES_V1,
        baseSchemaDigest = AnalysisPublicationSpecificationDigests.schema(resources),
    )
}

private fun source(
    app: String,
    surveyId: String,
    vararg fieldIds: String,
): AnalysisSourcePinV2 {
    val fields = fieldIds.sorted().map { fieldId ->
        AnalysisDefinitionFieldPinV1(
            fieldId = fieldId,
            presence = AnalysisFieldPresence.PRESENT,
            fieldType = FieldType.RATING,
            ratingVariant = RatingVariant.NPS,
            ratingScale = 11,
        )
    }
    return AnalysisSourcePinV2(
        app = app,
        surveyId = surveyId,
        surveyType = SurveyType.CUSTOM,
        selectedFieldIds = fieldIds.sorted(),
        definitions = listOf(
            AnalysisDefinitionPinV1(
                definitionHash = "d".repeat(64),
                fields = fields,
                flows = listOf(
                    AnalysisFlowPinV1(
                        flowHash = "f".repeat(64),
                        evaluatorVersion = SURVEY_FLOW_EVALUATOR_VERSION,
                        dependenciesByField = fieldIds.sorted().map { AnalysisFieldDependenciesV1(it, emptyList()) },
                    ),
                ),
            ),
        ),
    )
}
