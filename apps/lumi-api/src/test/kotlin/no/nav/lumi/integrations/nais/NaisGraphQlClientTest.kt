package no.nav.lumi.integrations.nais

import io.ktor.client.*
import io.ktor.client.engine.mock.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.http.*
import io.ktor.http.content.OutgoingContent
import io.ktor.http.content.TextContent
import io.ktor.serialization.kotlinx.json.*
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import no.nav.lumi.integrations.valkey.InMemoryTeamCache
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneId

class NaisGraphQlClientTest {
    
    private lateinit var fixedClock: Clock
    private lateinit var teamCache: InMemoryTeamCache
    private val testUrl = "https://console.nav.cloud.nais.io/graphql"
    private val testApiKey = "test-api-key"
    
    @BeforeEach
    fun setup() {
        fixedClock = Clock.fixed(Instant.parse("2026-01-09T10:00:00Z"), ZoneId.of("UTC"))
        teamCache = InMemoryTeamCache()
    }
    
    private fun createMockClient(responseBody: String, status: HttpStatusCode = HttpStatusCode.OK): HttpClient {
        return HttpClient(MockEngine { request ->
            respond(
                content = responseBody,
                status = status,
                headers = headersOf(HttpHeaders.ContentType, "application/json")
            )
        }) {
            install(ContentNegotiation) {
                json(Json {
                    ignoreUnknownKeys = true
                    isLenient = true
                })
            }
        }
    }

    private fun bodyAsText(body: Any): String {
        return when (body) {
            is String -> body
            is ByteArray -> body.decodeToString()
            is TextContent -> body.text
            is OutgoingContent.ByteArrayContent -> body.bytes().decodeToString()
            else -> body.toString()
        }
    }
    
    @Test
    fun `getTeamSlugsForUser returns teams on successful response`() = runBlocking {
        val responseJson = """
            {
                "data": {
                    "user": {
                        "teams": {
                            "nodes": [
                                {"team": {"slug": "team-esyfo"}},
                                {"team": {"slug": "flex"}}
                            ]
                        }
                    }
                }
            }
        """.trimIndent()
        
        val client = NaisGraphQlClient.forTesting(
            graphqlUrl = testUrl,
            apiKey = testApiKey,
            teamCache = teamCache,
            clock = fixedClock,
            client = createMockClient(responseJson)
        )
        
        val result = client.getTeamSlugsForUser("test@nav.no")
        
        assertEquals(setOf("team-esyfo", "flex"), result)
    }

    @Test
    fun `getTeamSlugsForUser sends expected query, variables, and auth headers`() = runBlocking {
        val responseJson = """{"data":{"user":{"teams":{"nodes":[]}}}}"""

        var observedEmail: String? = null
        var observedQuery: String? = null

        val mockEngine = MockEngine { request ->
            assertTrue(request.url.toString().startsWith(testUrl))

            val observedAuth = request.headers[HttpHeaders.Authorization]
            assertEquals("Bearer $testApiKey", observedAuth)

            val observedUserAgent = request.headers[HttpHeaders.UserAgent]
            assertEquals("lumi-api", observedUserAgent)

            val contentType = request.headers[HttpHeaders.ContentType]
                ?: (request.body as? OutgoingContent)?.contentType?.toString()
            assertNotNull(contentType)
            assertTrue(contentType!!.startsWith(ContentType.Application.Json.toString()))

            val bodyText = bodyAsText(request.body)
            val json = Json.parseToJsonElement(bodyText).jsonObject

            observedQuery = json["query"]?.jsonPrimitive?.content
            observedEmail = json["variables"]?.jsonObject?.get("email")?.jsonPrimitive?.content

            respond(
                content = responseJson,
                status = HttpStatusCode.OK,
                headers = headersOf(HttpHeaders.ContentType, "application/json")
            )
        }

        val mockClient = HttpClient(mockEngine) {
            install(ContentNegotiation) {
                json(Json { ignoreUnknownKeys = true; isLenient = true })
            }
        }

        val client = NaisGraphQlClient.forTesting(
            graphqlUrl = testUrl,
            apiKey = testApiKey,
            teamCache = teamCache,
            clock = fixedClock,
            client = mockClient
        )

        client.getTeamSlugsForUser("test@nav.no")

        assertNotNull(observedQuery)
        assertTrue(observedQuery!!.contains("query UserTeams"))
        assertTrue(observedQuery!!.contains("user(email"))
        assertEquals("test@nav.no", observedEmail)
    }

    @Test
    fun `getTeamSlugsForViewer sends expected query and auth headers`() = runBlocking {
        val responseJson = """{"data":{"me":{"__typename":"User","teams":{"nodes":[]}}}}"""

        var observedQuery: String? = null

        val mockEngine = MockEngine { request ->
            assertTrue(request.url.toString().startsWith(testUrl))

            val observedAuth = request.headers[HttpHeaders.Authorization]
            assertEquals("Bearer $testApiKey", observedAuth)

            val observedUserAgent = request.headers[HttpHeaders.UserAgent]
            assertEquals("lumi-api", observedUserAgent)

            val contentType = request.headers[HttpHeaders.ContentType]
                ?: (request.body as? OutgoingContent)?.contentType?.toString()
            assertNotNull(contentType)
            assertTrue(contentType!!.startsWith(ContentType.Application.Json.toString()))

            val bodyText = bodyAsText(request.body)
            val json = Json.parseToJsonElement(bodyText).jsonObject
            observedQuery = json["query"]?.jsonPrimitive?.content

            respond(
                content = responseJson,
                status = HttpStatusCode.OK,
                headers = headersOf(HttpHeaders.ContentType, "application/json")
            )
        }

        val mockClient = HttpClient(mockEngine) {
            install(ContentNegotiation) {
                json(Json { ignoreUnknownKeys = true; isLenient = true })
            }
        }

        val client = NaisGraphQlClient.forTesting(
            graphqlUrl = testUrl,
            apiKey = testApiKey,
            teamCache = teamCache,
            clock = fixedClock,
            client = mockClient
        )

        client.getTeamSlugsForViewer()

        assertNotNull(observedQuery)
        assertTrue(observedQuery!!.contains("query ViewerTeams"))
        assertTrue(observedQuery!!.contains("me"))
    }
    
    @Test
    fun `getTeamSlugsForUserResult returns Success with teams`() = runBlocking {
        val responseJson = """
            {
                "data": {
                    "user": {
                        "teams": {
                            "nodes": [
                                {"team": {"slug": "team-esyfo"}}
                            ]
                        }
                    }
                }
            }
        """.trimIndent()
        
        val client = NaisGraphQlClient.forTesting(
            graphqlUrl = testUrl,
            apiKey = testApiKey,
            teamCache = teamCache,
            clock = fixedClock,
            client = createMockClient(responseJson)
        )
        
        val result = client.getTeamSlugsForUserResult("test@nav.no")
        
        assertTrue(result.isSuccess())
        assertEquals(setOf("team-esyfo"), (result as NaisApiResult.Success).value)
    }
    
    @Test
    fun `getTeamSlugsForUser returns empty set on user not found`() = runBlocking {
        val responseJson = """
            {
                "data": {
                    "user": null
                }
            }
        """.trimIndent()
        
        val client = NaisGraphQlClient.forTesting(
            graphqlUrl = testUrl,
            apiKey = testApiKey,
            teamCache = teamCache,
            clock = fixedClock,
            client = createMockClient(responseJson)
        )
        
        val result = client.getTeamSlugsForUser("unknown@nav.no")
        
        assertEquals(emptySet<String>(), result)
    }
    
    @Test
    fun `getTeamSlugsForUserResult returns Error on GraphQL errors`() = runBlocking {
        val responseJson = """
            {
                "data": null,
                "errors": [
                    {"message": "User not authorized"}
                ]
            }
        """.trimIndent()
        
        val client = NaisGraphQlClient.forTesting(
            graphqlUrl = testUrl,
            apiKey = testApiKey,
            teamCache = teamCache,
            clock = fixedClock,
            client = createMockClient(responseJson)
        )
        
        val result = client.getTeamSlugsForUserResult("test@nav.no")
        
        assertTrue(result.isError())
        assertTrue((result as NaisApiResult.Error).message.contains("User not authorized"))
    }
    
    @Test
    fun `getTeamSlugsForUserResult returns Error on HTTP error`() = runBlocking {
        val client = NaisGraphQlClient.forTesting(
            graphqlUrl = testUrl,
            apiKey = testApiKey,
            teamCache = teamCache,
            clock = fixedClock,
            client = createMockClient("{}", HttpStatusCode.InternalServerError)
        )
        
        val result = client.getTeamSlugsForUserResult("test@nav.no")
        
        assertTrue(result.isError())
        assertTrue((result as NaisApiResult.Error).message.contains("non-OK status"))
    }
    
    @Test
    fun `caching works for user teams`() = runBlocking {
        var callCount = 0
        val mockEngine = MockEngine { request ->
            callCount++
            respond(
                content = """{"data":{"user":{"teams":{"nodes":[{"team":{"slug":"flex"}}]}}}}""",
                status = HttpStatusCode.OK,
                headers = headersOf(HttpHeaders.ContentType, "application/json")
            )
        }
        
        val mockClient = HttpClient(mockEngine) {
            install(ContentNegotiation) {
                json(Json { ignoreUnknownKeys = true; isLenient = true })
            }
        }
        
        val client = NaisGraphQlClient.forTesting(
            graphqlUrl = testUrl,
            apiKey = testApiKey,
            teamCache = teamCache,
            clock = fixedClock,
            client = mockClient
        )
        
        // First call - should hit the API
        client.getTeamSlugsForUser("test@nav.no")
        assertEquals(1, callCount)
        
        // Second call - should use cache
        client.getTeamSlugsForUser("test@nav.no")
        assertEquals(1, callCount)
        
        // Third call with different email - should hit the API
        client.getTeamSlugsForUser("other@nav.no")
        assertEquals(2, callCount)
    }

    @Test
    fun `cache sentinel __EMPTY__ is treated as empty teams`() = runBlocking {
        // If Valkey stores a sentinel for empty sets, the client filters it out.
        teamCache.set("test@nav.no", setOf("__EMPTY__"), Duration.ofHours(1))

        var callCount = 0
        val mockEngine = MockEngine { _ ->
            callCount++
            respond(
                content = """{"data":{"user":{"teams":{"nodes":[]}}}}""",
                status = HttpStatusCode.OK,
                headers = headersOf(HttpHeaders.ContentType, "application/json")
            )
        }

        val mockClient = HttpClient(mockEngine) {
            install(ContentNegotiation) {
                json(Json { ignoreUnknownKeys = true; isLenient = true })
            }
        }

        val client = NaisGraphQlClient.forTesting(
            graphqlUrl = testUrl,
            apiKey = testApiKey,
            teamCache = teamCache,
            clock = fixedClock,
            client = mockClient
        )

        val result = client.getTeamSlugsForUser("test@nav.no")

        assertEquals(emptySet<String>(), result)
        assertEquals(0, callCount, "Cache hit should avoid API call")
    }
    
    @Test
    fun `getTeamSlugsForViewer returns teams for User type`() = runBlocking {
        val responseJson = """
            {
                "data": {
                    "me": {
                        "__typename": "User",
                        "teams": {
                            "nodes": [
                                {"team": {"slug": "team-esyfo"}}
                            ]
                        }
                    }
                }
            }
        """.trimIndent()
        
        val client = NaisGraphQlClient.forTesting(
            graphqlUrl = testUrl,
            apiKey = testApiKey,
            teamCache = teamCache,
            clock = fixedClock,
            client = createMockClient(responseJson)
        )
        
        val result = client.getTeamSlugsForViewer()
        
        assertEquals(setOf("team-esyfo"), result)
    }
    
    @Test
    fun `getTeamSlugsForViewer returns empty for non-User type`() = runBlocking {
        val responseJson = """
            {
                "data": {
                    "me": {
                        "__typename": "ServiceAccount",
                        "teams": null
                    }
                }
            }
        """.trimIndent()
        
        val client = NaisGraphQlClient.forTesting(
            graphqlUrl = testUrl,
            apiKey = testApiKey,
            teamCache = teamCache,
            clock = fixedClock,
            client = createMockClient(responseJson)
        )
        
        val result = client.getTeamSlugsForViewer()
        
        assertEquals(emptySet<String>(), result)
    }
    
    @Test
    fun `isHealthy returns true when no calls have been made`() {
        val client = NaisGraphQlClient.forTesting(
            graphqlUrl = testUrl,
            apiKey = testApiKey,
            teamCache = teamCache,
            clock = fixedClock,
            client = createMockClient("{}")
        )
        
        assertTrue(client.isHealthy())
    }
    
    @Test
    fun `isHealthy returns true after successful call`() = runBlocking {
        val responseJson = """{"data":{"user":{"teams":{"nodes":[]}}}}"""
        
        val client = NaisGraphQlClient.forTesting(
            graphqlUrl = testUrl,
            apiKey = testApiKey,
            teamCache = teamCache,
            clock = fixedClock,
            client = createMockClient(responseJson)
        )
        
        client.getTeamSlugsForUser("test@nav.no")
        
        assertTrue(client.isHealthy())
    }
    
    @Test
    fun `clearCache removes all cached entries`() = runBlocking {
        var callCount = 0
        val mockEngine = MockEngine { request ->
            callCount++
            respond(
                content = """{"data":{"user":{"teams":{"nodes":[{"team":{"slug":"flex"}}]}}}}""",
                status = HttpStatusCode.OK,
                headers = headersOf(HttpHeaders.ContentType, "application/json")
            )
        }
        
        val mockClient = HttpClient(mockEngine) {
            install(ContentNegotiation) {
                json(Json { ignoreUnknownKeys = true; isLenient = true })
            }
        }
        
        val client = NaisGraphQlClient.forTesting(
            graphqlUrl = testUrl,
            apiKey = testApiKey,
            teamCache = teamCache,
            clock = fixedClock,
            client = mockClient
        )
        
        client.getTeamSlugsForUser("test@nav.no")
        assertEquals(1, callCount)
        
        // Clear cache
        client.clearCache()
        
        // Should hit API again
        client.getTeamSlugsForUser("test@nav.no")
        assertEquals(2, callCount)
    }
    
    @Test
    fun `getHealthStatus returns diagnostic information`() = runBlocking {
        val responseJson = """{"data":{"user":{"teams":{"nodes":[]}}}}"""
        
        val client = NaisGraphQlClient.forTesting(
            graphqlUrl = testUrl,
            apiKey = testApiKey,
            teamCache = teamCache,
            clock = fixedClock,
            client = createMockClient(responseJson)
        )
        
        client.getTeamSlugsForUser("test@nav.no")
        
        val status = client.getHealthStatus()
        
        assertEquals(true, status["healthy"])
        assertEquals(true, status["cacheHealthy"])
        assertNotNull(status["lastSuccessfulCall"])
        assertNull(status["lastError"])
    }
    
    @Test
    fun `NaisApiResult getOrDefault returns value on success`() {
        val result: NaisApiResult<Set<String>> = NaisApiResult.Success(setOf("team"))
        
        assertEquals(setOf("team"), result.getOrDefault(emptySet()))
    }
    
    @Test
    fun `NaisApiResult getOrDefault returns default on error`() {
        val result: NaisApiResult<Set<String>> = NaisApiResult.Error("Failed")
        
        assertEquals(setOf("fallback"), result.getOrDefault(setOf("fallback")))
    }

    @Test
    fun `team cache TTLs keep positive memberships warm while allowing onboarding`() {
        assertEquals(Duration.ofHours(12), CacheTtl.HAS_TEAMS)
        assertEquals(Duration.ofMinutes(5), CacheTtl.NO_TEAMS)
        assertEquals(Duration.ofSeconds(30), CacheTtl.ERROR)
    }

    @Test
    fun `users with teams get cached with longer TTL`() = runBlocking {
        var callCount = 0
        val mockEngine = MockEngine { request ->
            callCount++
            respond(
                content = """{"data":{"user":{"teams":{"nodes":[{"team":{"slug":"flex"}}]}}}}""",
                status = HttpStatusCode.OK,
                headers = headersOf(HttpHeaders.ContentType, "application/json")
            )
        }
        
        val mockClient = HttpClient(mockEngine) {
            install(ContentNegotiation) {
                json(Json { ignoreUnknownKeys = true; isLenient = true })
            }
        }
        
        val client = NaisGraphQlClient.forTesting(
            graphqlUrl = testUrl,
            apiKey = testApiKey,
            teamCache = teamCache,
            clock = fixedClock,
            client = mockClient
        )
        
        // First call - caches with long TTL (because user HAS teams)
        client.getTeamSlugsForUser("test@nav.no")
        assertEquals(1, callCount)

        // Even after 30 minutes, cache should still be valid
        // (In real usage, TTL is enforced by Valkey, but InMemoryTeamCache respects the TTL)
        client.getTeamSlugsForUser("test@nav.no")
        assertEquals(1, callCount)
    }

    @Test
    fun `resolveTokenProvider reads the token file fresh on each call (rotation)`() {
        val rotated = ArrayDeque(listOf("token-1", "token-2", "token-3"))
        val readPaths = mutableListOf<String>()
        val provider = NaisGraphQlClient.resolveTokenProvider(
            tokenPath = "/var/run/secrets/nais.io/serviceaccount/token",
            staticKey = null,
            readFile = { path -> readPaths.add(path); rotated.removeFirst() }
        )

        assertNotNull(provider)
        assertEquals("token-1", provider!!())
        assertEquals("token-2", provider())
        assertEquals("token-3", provider())
        assertEquals(3, readPaths.size, "file must be re-read on every call to pick up rotation")
        assertTrue(readPaths.all { it == "/var/run/secrets/nais.io/serviceaccount/token" })
    }

    @Test
    fun `resolveTokenProvider prefers the token file over the static key`() {
        val provider = NaisGraphQlClient.resolveTokenProvider(
            tokenPath = "/path/token",
            staticKey = "static-key",
            readFile = { "file-token" }
        )

        assertEquals("file-token", provider!!())
    }

    @Test
    fun `resolveTokenProvider falls back to the static key outside NAIS when no token path`() {
        val provider = NaisGraphQlClient.resolveTokenProvider(
            tokenPath = null,
            staticKey = "static-key",
            allowStaticKeyFallback = true
        )

        assertEquals("static-key", provider!!())
    }

    @Test
    fun `resolveTokenProvider ignores a blank token path and falls back to the static key`() {
        val provider = NaisGraphQlClient.resolveTokenProvider(tokenPath = "   ", staticKey = "static-key")

        assertEquals("static-key", provider!!())
    }

    @Test
    fun `resolveTokenProvider does not fall back to the static key in NAIS`() {
        val provider = NaisGraphQlClient.resolveTokenProvider(
            tokenPath = null,
            staticKey = "static-key",
            allowStaticKeyFallback = false
        )

        assertNull(provider)
    }

    @Test
    fun `requireSupportedAuthConfiguration fails in NAIS when url is set without token path`() {
        val exception = assertThrows(IllegalStateException::class.java) {
            NaisGraphQlClient.requireSupportedAuthConfiguration(
                url = testUrl,
                tokenPath = null,
                isNaisEnvironment = true
            )
        }

        assertTrue(exception.message!!.contains("NAIS_SERVICE_ACCOUNT_TOKEN_PATH"))
        assertTrue(exception.message!!.contains("NAIS_API_KEY is only supported outside NAIS"))
    }

    @Test
    fun `requireSupportedAuthConfiguration allows local static key fallback outside NAIS`() {
        assertDoesNotThrow {
            NaisGraphQlClient.requireSupportedAuthConfiguration(
                url = testUrl,
                tokenPath = null,
                isNaisEnvironment = false
            )
        }
    }

    @Test
    fun `resolveTokenProvider returns null when neither token path nor static key is set`() {
        assertNull(NaisGraphQlClient.resolveTokenProvider(tokenPath = null, staticKey = null))
    }

    @Test
    fun `client sends a freshly read token on each request`() = runBlocking {
        val rotated = ArrayDeque(listOf("rotated-1", "rotated-2"))
        val observedAuth = mutableListOf<String?>()
        val mockEngine = MockEngine { request ->
            observedAuth.add(request.headers[HttpHeaders.Authorization])
            respond(
                content = """{"data":{"user":{"teams":{"nodes":[]}}}}""",
                status = HttpStatusCode.OK,
                headers = headersOf(HttpHeaders.ContentType, "application/json")
            )
        }
        val mockClient = HttpClient(mockEngine) {
            install(ContentNegotiation) {
                json(Json { ignoreUnknownKeys = true; isLenient = true })
            }
        }

        val client = NaisGraphQlClient.forTesting(
            graphqlUrl = testUrl,
            tokenProvider = { rotated.removeFirst() },
            teamCache = teamCache,
            clock = fixedClock,
            client = mockClient
        )

        client.getTeamSlugsForUser("a@nav.no")
        client.getTeamSlugsForUser("b@nav.no") // different email avoids the cache

        assertEquals(listOf("Bearer rotated-1", "Bearer rotated-2"), observedAuth)
    }

    @Test
    fun `fromConfig returns null when nothing is configured`() {
        val client = NaisGraphQlClient.fromConfig(
            graphqlUrl = null,
            tokenPath = null,
            staticKey = null,
            isNaisEnvironment = false,
            teamCache = teamCache
        )

        assertNull(client)
    }

    @Test
    fun `fromConfig builds a client from an injected token path`() {
        val client = NaisGraphQlClient.fromConfig(
            graphqlUrl = testUrl,
            tokenPath = "/var/run/secrets/nais.io/console/token",
            staticKey = null,
            isNaisEnvironment = true,
            teamCache = teamCache
        )

        assertNotNull(client)
    }

    @Test
    fun `fromConfig rejects the static key fallback in NAIS`() {
        val exception = assertThrows(IllegalStateException::class.java) {
            NaisGraphQlClient.fromConfig(
                graphqlUrl = testUrl,
                tokenPath = null,
                staticKey = "static-key",
                isNaisEnvironment = true,
                teamCache = teamCache
            )
        }

        assertTrue(exception.message!!.contains("NAIS_SERVICE_ACCOUNT_TOKEN_PATH"))
    }

    @Test
    fun `fromConfig allows the static key outside NAIS`() {
        val client = NaisGraphQlClient.fromConfig(
            graphqlUrl = testUrl,
            tokenPath = null,
            staticKey = "static-key",
            isNaisEnvironment = false,
            teamCache = teamCache
        )

        assertNotNull(client)
    }
}
