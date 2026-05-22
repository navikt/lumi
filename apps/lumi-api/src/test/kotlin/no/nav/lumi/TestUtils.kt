package no.nav.lumi

import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.routing.*
import io.ktor.server.testing.*
import kotlinx.serialization.json.Json
import no.nav.lumi.config.auth.BrukerPrincipal
import no.nav.lumi.config.auth.TeamAuthorizationPlugin
import no.nav.lumi.config.auth.NaisTeamLookup
import no.nav.lumi.integrations.nais.NaisApiResult
import no.nav.lumi.config.configureSerialization
import no.nav.lumi.config.configureStatusPages
import no.nav.lumi.config.configureRateLimiting
import no.nav.lumi.config.DatabaseHolder
import no.nav.lumi.domain.SaveResult
import no.nav.lumi.integrations.valkey.InMemoryStatsCache
import no.nav.lumi.repository.FeedbackRepository
import no.nav.lumi.routes.feedbackRoutes
import no.nav.lumi.routes.internalRoutes
import no.nav.lumi.routes.statsRoutes
import no.nav.lumi.routes.exportRoutes
import no.nav.lumi.routes.markerRoutes
import no.nav.lumi.routes.surveyFacetRoutes
import no.nav.lumi.routes.submissionRoutes
import no.nav.lumi.routes.discoveryRoutes
import no.nav.lumi.repository.FeedbackStatsRepository
import java.time.LocalDate
import java.sql.Timestamp
import no.nav.lumi.service.FeedbackService
import no.nav.lumi.service.StatsCacheInvalidator
import no.nav.lumi.service.StatsService
import no.nav.lumi.service.ExportService
import java.time.OffsetDateTime
import java.util.UUID

fun SaveResult.createdId(): String = when (this) {
    is SaveResult.Created -> id
    is SaveResult.Duplicate -> error("Expected created save result, got duplicate")
}

/**
 * Creates a test client configured with JSON serialization
 */
fun ApplicationTestBuilder.createTestClient() = createClient {
    install(ContentNegotiation) {
        json(Json {
            prettyPrint = true
            isLenient = true
            ignoreUnknownKeys = true
        })
    }
}

/**
 * Insert test feedback into database
 */
fun insertTestFeedback(
    id: String = UUID.randomUUID().toString(),
    team: String = "team-test",
    app: String = "app-test",
    rating: Int = 4,
    text: String = "Test feedback",
    surveyId: String = "survey-$id",
    surveyType: String = "rating",
    tags: String? = null,
    opprettet: OffsetDateTime = OffsetDateTime.now()
) {
    TestDatabase.dataSource.connection.use { conn ->
        conn.prepareStatement("""
            INSERT INTO feedback (id, opprettet, feedback_json, team, app)
            VALUES (?, ?, ?::jsonb, ?, ?)
        """).use { stmt ->
            stmt.setString(1, id)
            stmt.setObject(2, java.sql.Timestamp.from(opprettet.toInstant()))
            stmt.setString(3, """
                {
                    "schemaVersion": 1,
                    "surveyId": "$surveyId",
                    "surveyType": "$surveyType",
                    "context": {
                        "pathname": "/test/path",
                        "deviceType": "desktop"
                    },
                    "answers": [
                        {
                          "fieldId": "svar",
                          "fieldType": "RATING",
                          "question": {"label": "Hvordan opplevde du tjenesten?"},
                          "value": {"type": "rating", "rating": $rating, "ratingVariant": "emoji", "ratingScale": 5}
                        },
                        {
                          "fieldId": "feedback",
                          "fieldType": "TEXT",
                          "question": {"label": "Har du tilbakemelding?"},
                          "value": {"type": "text", "text": "$text"}
                        }
                    ],
                    "startedAt": "${opprettet.minusMinutes(1).toInstant()}",
                    "submittedAt": "${opprettet.toInstant()}"
                }
            """.trimIndent())
            stmt.setString(4, team)
            stmt.setString(5, app)
            stmt.executeUpdate()
        }
        insertFeedbackTags(conn, id, tags)
        conn.commit()
    }
}

fun insertTestFeedbackWithJson(
    id: String = UUID.randomUUID().toString(),
    team: String = "team-test",
    app: String = "app-test",
    feedbackJson: String,
    tags: String? = null,
    opprettet: OffsetDateTime = OffsetDateTime.now(),
) {
    TestDatabase.dataSource.connection.use { conn ->
        conn.prepareStatement(
            """
            INSERT INTO feedback (id, opprettet, feedback_json, team, app)
            VALUES (?, ?, ?::jsonb, ?, ?)
            """.trimIndent()
        ).use { stmt ->
            stmt.setString(1, id)
            stmt.setObject(2, Timestamp.from(opprettet.toInstant()))
            stmt.setString(3, feedbackJson)
            stmt.setString(4, team)
            stmt.setString(5, app)
            stmt.executeUpdate()
        }
        insertFeedbackTags(conn, id, tags)
        conn.commit()
    }
}

private fun insertFeedbackTags(conn: java.sql.Connection, feedbackId: String, tags: String?) {
    val normalizedTags = tags
        ?.split(",")
        ?.map { it.trim().lowercase() }
        ?.filter { it.isNotBlank() }
        ?: return

    if (normalizedTags.isEmpty()) return

    conn.prepareStatement(
        """
        INSERT INTO feedback_tag (feedback_id, tag)
        VALUES (?, ?)
        ON CONFLICT DO NOTHING
        """.trimIndent()
    ).use { stmt ->
        for (tag in normalizedTags) {
            stmt.setString(1, feedbackId)
            stmt.setString(2, tag)
            stmt.addBatch()
        }
        stmt.executeBatch()
    }
}

fun insertTestTheme(
    team: String,
    name: String,
    keywords: List<String>,
    color: String? = null,
    priority: Int = 0,
    analysisContext: String = "GENERAL_FEEDBACK",
): String {
    val id = UUID.randomUUID().toString()

    TestDatabase.dataSource.connection.use { conn ->
        conn.prepareStatement(
            """
            INSERT INTO text_theme (id, team, name, keywords, color, priority, analysis_context)
            VALUES (?::uuid, ?, ?, ?, ?, ?, ?)
            """.trimIndent()
        ).use { stmt ->
            stmt.setString(1, id)
            stmt.setString(2, team)
            stmt.setString(3, name)
            stmt.setArray(4, conn.createArrayOf("text", keywords.toTypedArray()))
            stmt.setString(5, color)
            stmt.setInt(6, priority)
            stmt.setString(7, analysisContext)
            stmt.executeUpdate()
        }
        conn.commit()
    }

    return id
}

fun insertTestRatingMarker(
    id: String = UUID.randomUUID().toString(),
    team: String = "team-test",
    surveyId: String,
    markerDate: LocalDate = LocalDate.now(),
    label: String = "Lansering",
    description: String? = null,
    color: String? = "#1C64F2",
    createdBy: String? = "A123456",
): String {
    TestDatabase.dataSource.connection.use { conn ->
        conn.prepareStatement(
            """
            INSERT INTO rating_marker (id, team, survey_id, marker_date, label, description, color, created_by)
            VALUES (?::uuid, ?, ?, ?, ?, ?, ?, ?)
            """.trimIndent()
        ).use { stmt ->
            stmt.setString(1, id)
            stmt.setString(2, team)
            stmt.setString(3, surveyId)
            stmt.setObject(4, markerDate)
            stmt.setString(5, label)
            stmt.setString(6, description)
            stmt.setString(7, color)
            stmt.setString(8, createdBy)
            stmt.executeUpdate()
        }
        conn.commit()
    }

    return id
}

/**
 * Test application module with authentication bypassed
 */
fun Application.testModule(
    feedbackService: FeedbackService = FeedbackService(),
    statsRepository: FeedbackStatsRepository = FeedbackStatsRepository()
) {
    // Initialize test database
    DatabaseHolder.initializeForTesting(TestDatabase.dataSource)
    TestDatabase.initialize()
    
    configureSerialization()
    configureStatusPages()
    configureRateLimiting()
    install(io.ktor.server.resources.Resources)
    
    // Test auth that creates a BrukerPrincipal from any "Bearer" token
    install(Authentication) {
        bearer("test-azure") {
            realm = "lumi-api-test"
            authenticate { tokenCredential ->
                if (tokenCredential.token.isNotBlank()) {
                    BrukerPrincipal(
                        navIdent = "A123456",
                        name = "Test User",
                        email = "test.user@nav.no",
                        clientId = "dev-gcp:team-esyfo:lumi-dashboard",
                        // Groups are kept for realism, but team access is resolved via NAIS lookup in tests.
                        groups = listOf(
                            "5066bb56-7f19-4b49-ae48-f1ba66abf546", // teamsykefravr
                            "ef4e9824-6f3a-4933-8f40-6edf5233d4d2", // team-esyfo
                            "00000000-0000-0000-0000-000000000001", // flex (test)
                            "00000000-0000-0000-0000-000000000002"  // team-test
                        )
                    )
                } else null
            }
        }
    }

    val testNaisTeamLookup = object : NaisTeamLookup {
        private val teams = setOf(
            "flex",
            "team-test",
            "team-esyfo",
            "teamsykefravr",
        )

        override suspend fun getTeamSlugsForUserResult(email: String): NaisApiResult<Set<String>> =
            NaisApiResult.Success(teams)

        override suspend fun getTeamSlugsForViewerResult(): NaisApiResult<Set<String>> =
            NaisApiResult.Success(teams)
    }
    
    // Create services with the injected repositories/services
    val statsCache = InMemoryStatsCache()
    val statsService = StatsService(FeedbackRepository(), statsRepository, statsCache = statsCache)
    val exportService = ExportService(FeedbackRepository())
    val statsCacheInvalidator = StatsCacheInvalidator(statsCache)
    
    routing {
        internalRoutes()

        // Public submission API (local mode in tests)
        submissionRoutes(feedbackService)

        authenticate("test-azure") {
            // Install TeamAuthorizationPlugin like production
            install(TeamAuthorizationPlugin) {
                // Ensure tests don't depend on NAIS env vars.
                naisTeamLookupProvider = { testNaisTeamLookup }
            }
            
            feedbackRoutes(feedbackService, statsCacheInvalidator)
            surveyFacetRoutes(feedbackService, statsCacheInvalidator)
            markerRoutes()
            statsRoutes(statsService)
            exportRoutes(exportService)
            discoveryRoutes()
        }
    }
}
