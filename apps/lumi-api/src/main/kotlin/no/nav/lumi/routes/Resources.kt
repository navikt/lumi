package no.nav.lumi.routes

import io.ktor.resources.*
import kotlinx.serialization.Serializable

@Resource("/api/v1/intern")
class ApiV1Intern {
    
    @Resource("feedback")
    @Serializable
    class Feedback(
        val parent: ApiV1Intern = ApiV1Intern(),
        /** Optional team scope. If omitted, the backend selects a default authorized team. */
        val team: String? = null,
        /** Include feedback from archived surveys. Defaults to false. */
        val includeArchived: Boolean? = null,
        val app: String? = null,
        val page: Int? = null,
        val size: Int? = null,
        /** Filter for feedback with text responses */
        val hasText: Boolean? = null,
        /** Filter for low ratings (1-2) */
        val lowRating: Boolean? = null,
        /** Tags filter - repeated params like tag=foo&tag=bar (also accepts comma-separated values per entry) */
        val tag: List<String>? = null,
        /** Full-text search query */
        val query: String? = null,
        /** Start date (YYYY-MM-DD, Europe/Oslo inclusive) */
        val fromDate: String? = null,
        /** End date (YYYY-MM-DD, Europe/Oslo inclusive) */
        val toDate: String? = null,
        /** Survey ID filter */
        val surveyId: String? = null,
        /** Device type filter: mobile, tablet, desktop */
        val deviceType: String? = null,
        /** Theme filter (themeId or 'uncategorized') */
        val theme: String? = null,
        /** Task filter for Top Tasks drill-down */
        val task: String? = null,
        /** Segment filter - repeated params like segment=key:value */
        val segment: List<String>? = null,
        /** Choice filters — repeated params, each in format "fieldId:optionId" */
        val choice: List<String>? = null,
        /** Rating filters — repeated params, each in format "fieldId:ratingValue" */
        val rating: List<String>? = null,
        /** Phrase filter — repeated param support is validated server-side, single value only */
        val phrase: List<String>? = null,
        // Legacy single-value params (backward compat for bookmarked URLs)
        val ratingFieldId: String? = null,
        val ratingValue: Int? = null,
        val choiceFieldId: String? = null,
        val choiceValue: String? = null,
    ) {
        @Resource("{id}")
        @Serializable
        class Id(val parent: Feedback, val id: String) {
            @Resource("tags")
            @Serializable
            class Tags(val parent: Id, val tag: String? = null)
        }

        @Resource("tags")
        @Serializable
        class AllTags(val parent: Feedback)

        @Resource("teams")
        @Serializable
        class Teams(val parent: Feedback)

        @Resource("metadata-keys")
        @Serializable
        class MetadataKeys(
            val parent: Feedback, 
            val surveyId: String,
            /** Max unique values per key. Keys with more values are filtered out. Default 10. */
            val maxCardinality: Int? = 10
        )
    }

    @Resource("stats")
    @Serializable
    class Stats(
        val parent: ApiV1Intern = ApiV1Intern(),
        /** Optional team scope. If omitted, the backend selects a default authorized team. */
        val team: String? = null,
        /** Include feedback from archived surveys. Defaults to false. */
        val includeArchived: Boolean? = null,
        val app: String? = null,
        /** Start date (YYYY-MM-DD, Europe/Oslo inclusive) */
        val fromDate: String? = null,
        /** End date (YYYY-MM-DD, Europe/Oslo inclusive) */
        val toDate: String? = null,
        /** Survey ID filter */
        val surveyId: String? = null,
        /** Device type filter */
        val deviceType: String? = null,
        /** Segment filter - repeated params like segment=key:value */
        val segment: List<String>? = null,
        /** Task filter for Top Tasks drill-down */
        val task: String? = null,
        /** Choice filters — repeated params, each in format "fieldId:optionId" */
        val choice: List<String>? = null,
        /** Rating filters — repeated params, each in format "fieldId:ratingValue" */
        val rating: List<String>? = null,
        /** Optional structured field to aggregate over time in the dashboard response. */
        val trendFieldId: String? = null,
        /** Calendar bucket for trendFieldId: day, week or month. Defaults to week. */
        val trendGranularity: String? = null,
        // Legacy single-value params (backward compat for bookmarked URLs)
        val ratingFieldId: String? = null,
        val ratingValue: Int? = null,
        val choiceFieldId: String? = null,
        val choiceValue: String? = null,
    ) {
        @Resource("dashboard")
        @Serializable
        class Dashboard(val parent: Stats)

        @Resource("overview")
        @Serializable
        class Overview(val parent: Stats)

        @Resource("ratings")
        @Serializable
        class Ratings(val parent: Stats)

        @Resource("timeline")
        @Serializable
        class Timeline(val parent: Stats)

        @Resource("top-tasks")
        @Serializable
        class TopTasks(val parent: Stats)

        @Resource("survey-types")
        @Serializable
        class SurveyTypes(val parent: Stats)

        @Resource("blockers")
        @Serializable
        class Blockers(val parent: Stats)

        @Resource("discovery")
        @Serializable
        class Discovery(val parent: Stats)

        @Resource("task-priority")
        @Serializable
        class TaskPriority(val parent: Stats)
    }

    @Resource("themes")
    @Serializable
    class Themes(
        val parent: ApiV1Intern = ApiV1Intern(),
        /** Optional team scope. If omitted, the backend selects a default authorized team. */
        val team: String? = null,
        /** Optional theme context filter (GENERAL_FEEDBACK | BLOCKER) */
        val context: String? = null
    ) {
        @Resource("{id}")
        @Serializable
        class Id(val parent: Themes, val id: String)
    }

    @Resource("surveys")
    @Serializable
    class Surveys(
        val parent: ApiV1Intern = ApiV1Intern(),
        /** Optional team scope. If omitted, the backend selects a default authorized team. */
        val team: String? = null,
    ) {
        @Resource("{surveyId}")
        @Serializable
        class Id(
            val parent: Surveys = Surveys(),
            val surveyId: String,
        ) {
            @Resource("markers")
            @Serializable
            class Markers(
                val parent: Surveys.Id,
                /** Start date (YYYY-MM-DD) */
                val fromDate: String? = null,
                /** End date (YYYY-MM-DD) */
                val toDate: String? = null,
            ) {
                @Resource("{id}")
                @Serializable
                class Id(val parent: Markers, val id: String)
            }

            @Resource("archive")
            @Serializable
            class Archive(val parent: Id)

            @Resource("context-tags")
            @Serializable
            class ContextTags(
                val parent: Id,
                /** Max unique values per key. Keys with more values are filtered out. Default 10. */
                val maxCardinality: Int? = 10,
                /** Task filter for Top Tasks drill-down (matches option label) */
                val task: String? = null,
                /** Segment filter - repeated params like segment=key:value */
                val segment: List<String>? = null,
                /** Start date (YYYY-MM-DD, Europe/Oslo inclusive) */
                val fromDate: String? = null,
                /** End date (YYYY-MM-DD, Europe/Oslo inclusive) */
                val toDate: String? = null,
                /** Device type filter: mobile, tablet, desktop */
                val deviceType: String? = null,
                /** Filter for feedback with text responses */
                val hasText: Boolean? = null,
                /** Filter for low ratings (1-2) */
                val lowRating: Boolean? = null,
            )
        }
    }

    @Resource("filters")
    @Serializable
    class Filters(val parent: ApiV1Intern = ApiV1Intern()) {
        @Resource("bootstrap")
        @Serializable
        class Bootstrap(
            val parent: Filters = Filters(),
            /** Optional team scope. If omitted, the backend selects a default authorized team. */
            val team: String? = null,
            /** Bypass the cached response without changing the shared cache entry. */
            val refresh: String? = null,
        )
    }

    /**
     * Returns the teams the user is authorized for, along with the apps seen in each team.
     *
     * Query param `team` is accepted for consistency (and to drive authorization scope),
     * but the response includes all authorized teams.
     */
    @Resource("teams")
    @Serializable
    class Teams(
        val parent: ApiV1Intern = ApiV1Intern(),
        /** Optional team scope. If omitted, the backend selects a default authorized team. */
        val team: String? = null,
    )

    @Resource("export")
    @Serializable
    class Export(
        val parent: ApiV1Intern = ApiV1Intern(),
        /** Optional team scope. If omitted, the backend selects a default authorized team. */
        val team: String? = null,
        /** Include feedback from archived surveys. Defaults to false. */
        val includeArchived: Boolean? = null,
        val format: String = "CSV",
        val app: String? = null,
        val hasText: Boolean? = null,
        val lowRating: Boolean? = null,
        val tag: List<String>? = null,
        val query: String? = null,
        val fromDate: String? = null,
        val toDate: String? = null,
        val surveyId: String? = null,
        val deviceType: String? = null,
        val segment: List<String>? = null,
        /** Theme filter (themeId or 'uncategorized') */
        val theme: String? = null,
        /** Task filter for Top Tasks drill-down */
        val task: String? = null,
        /** Choice filters — repeated params, each in format "fieldId:optionId" */
        val choice: List<String>? = null,
        /** Rating filters — repeated params, each in format "fieldId:ratingValue" */
        val rating: List<String>? = null,
        /** Phrase filter — repeated param support is validated server-side, single value only */
        val phrase: List<String>? = null,
        // Legacy single-value params (backward compat for bookmarked URLs)
        val ratingFieldId: String? = null,
        val ratingValue: Int? = null,
        val choiceFieldId: String? = null,
        val choiceValue: String? = null,
    )

    @Resource("authoring")
    @Serializable
    class Authoring(val parent: ApiV1Intern = ApiV1Intern()) {
        @Resource("projects")
        @Serializable
        class Projects(
            val parent: Authoring = Authoring(),
            /** Optional team scope. If omitted, the backend selects a default authorized team. */
            val team: String? = null,
        ) {
            @Resource("{projectId}")
            @Serializable
            class Id(
                val parent: Projects = Projects(),
                val projectId: String,
            ) {
                @Resource("draft")
                @Serializable
                class Draft(val parent: Id)

                @Resource("revisions")
                @Serializable
                class ProjectRevisions(val parent: Id)
            }
        }

        @Resource("revisions")
        @Serializable
        class Revisions(val parent: Authoring = Authoring()) {
            @Resource("{revisionId}")
            @Serializable
            class Id(
                val parent: Revisions = Revisions(),
                val revisionId: String,
            )
        }
    }
}
