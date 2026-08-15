package no.nav.lumi.proxy

import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation as ServerContentNegotiation
import io.ktor.server.plugins.calllogging.*
import io.ktor.server.plugins.statuspages.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.utils.io.core.readText
import io.ktor.utils.io.readRemaining
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.slf4j.LoggerFactory
import org.slf4j.event.Level

private val logger = LoggerFactory.getLogger("LumiSubmissionProxy")

fun main() {
    embeddedServer(Netty, port = 8080, module = Application::module).start(wait = true)
}

fun Application.module() {
    val config = ProxyConfig.fromEnvironment()

    install(CallLogging) { level = Level.INFO }
    install(ServerContentNegotiation) {
        json(Json { ignoreUnknownKeys = true })
    }
    install(StatusPages) {
        exception<ProxyAuthException> { call, cause ->
            logger.warn("Authentication failed: ${cause.message}")
            call.respondText(cause.message ?: "Unauthorized", status = HttpStatusCode.Unauthorized)
        }
        exception<ProxyPayloadException> { call, cause ->
            logger.warn("Payload error: ${cause.message}")
            call.respondText(cause.message ?: "Payload too large", status = HttpStatusCode.PayloadTooLarge)
        }
        exception<Throwable> { call, cause ->
            logger.error("Unhandled exception", cause)
            call.respondText("Internal server error", status = HttpStatusCode.InternalServerError)
        }
    }

    val texasClient = config.tokenIntrospectionEndpoint?.let { TexasClient(it) }
    val httpClient = createForwardingClient()

    routing {
        get("/internal/isAlive") { call.respondText("OK") }
        get("/internal/isReady") { call.respondText("OK") }

        post("/api/azure/v1/feedback") {
            val identity = authenticateRequest(call, texasClient, config)

            val body = receiveBody(call)

            val targetUrl = "${config.lumiApiBaseUrl}/api/internal/v1/feedback"
            val response = try {
                httpClient.post(targetUrl) {
                    contentType(ContentType.Application.Json)
                    header("X-Lumi-Submission-Key", config.internalSubmissionKey)
                    header("X-Lumi-Caller-Identity", identity)
                    setBody(body)
                }
            } catch (e: Exception) {
                logger.error("Failed to forward submission to lumi-api at $targetUrl", e)
                call.respond(HttpStatusCode.BadGateway, mapOf("error" to "Failed to forward submission"))
                return@post
            }

            val responseBody = response.bodyAsText()
            call.respondText(responseBody, ContentType.Application.Json, response.status)
        }
    }
}

private suspend fun authenticateRequest(
    call: ApplicationCall,
    texasClient: TexasClient?,
    config: ProxyConfig
): String {
    if (texasClient == null) {
        check(config.localAuthBypassEnabled) {
            "Local auth bypass must be enabled when Texas is unavailable"
        }
        logger.warn("Running with explicit local auth bypass, using mock identity")
        return "local:local-dev:local-app"
    }

    val authHeader = call.request.header(HttpHeaders.Authorization)
    if (authHeader == null || !authHeader.startsWith("Bearer ")) {
        throw ProxyAuthException("Missing or invalid Authorization header")
    }

    val token = authHeader.removePrefix("Bearer ")
    val result = texasClient.introspect(token)

    if (result == null || !result.active) {
        throw ProxyAuthException("Token validation failed")
    }

    val azpName = result.azpName
    if (azpName.isNullOrBlank()) {
        throw ProxyAuthException("Missing azp_name claim in token")
    }

    logger.info("Authenticated submission from azp_name=$azpName")
    return azpName
}

private const val MAX_BODY_BYTES = 1_048_576L

private suspend fun receiveBody(call: ApplicationCall): String {
    val contentLength = call.request.headers[HttpHeaders.ContentLength]?.toLongOrNull()
    if (contentLength == null) {
        throw ProxyPayloadException("Missing Content-Length header")
    }
    if (contentLength > MAX_BODY_BYTES) {
        throw ProxyPayloadException("Payload too large")
    }

    val packet = call.receiveChannel().readRemaining(MAX_BODY_BYTES + 1)
    val text = packet.readText()
    if (text.toByteArray().size > MAX_BODY_BYTES) {
        throw ProxyPayloadException("Payload too large")
    }

    return text
}

private fun createForwardingClient() = HttpClient(CIO) {
    install(HttpTimeout) {
        connectTimeoutMillis = 5_000
        requestTimeoutMillis = 10_000
        socketTimeoutMillis = 10_000
    }
}

class ProxyAuthException(message: String) : RuntimeException(message)
class ProxyPayloadException(message: String) : RuntimeException(message)

/**
 * Minimal Texas introspection client for this proxy.
 */
class TexasClient(private val introspectionEndpoint: String) {
    private val client = HttpClient(CIO) {
        install(HttpTimeout) {
            connectTimeoutMillis = 2_000
            requestTimeoutMillis = 5_000
            socketTimeoutMillis = 5_000
        }
        install(ContentNegotiation) {
            json(Json { ignoreUnknownKeys = true; isLenient = true })
        }
    }

    suspend fun introspect(token: String): IntrospectionResult? {
        return try {
            val response = client.post(introspectionEndpoint) {
                contentType(ContentType.Application.Json)
                setBody(IntrospectionRequest(identityProvider = "entra_id", token = token))
            }
            if (response.status != HttpStatusCode.OK) {
                logger.warn("Texas introspection failed: ${response.status}")
                return null
            }
            response.body<IntrospectionResult>()
        } catch (e: Exception) {
            logger.error("Texas introspection error", e)
            null
        }
    }
}

@Serializable
data class IntrospectionRequest(
    @SerialName("identity_provider") val identityProvider: String,
    val token: String
)

@Serializable
data class IntrospectionResult(
    val active: Boolean,
    @SerialName("azp_name") val azpName: String? = null
)

data class ProxyConfig(
    val lumiApiBaseUrl: String,
    val internalSubmissionKey: String,
    val tokenIntrospectionEndpoint: String?,
    val localAuthBypassEnabled: Boolean,
) {
    companion object {
        fun fromEnvironment(
            getenv: (String) -> String? = System::getenv,
        ): ProxyConfig {
            val tokenIntrospectionEndpoint = getenv("NAIS_TOKEN_INTROSPECTION_ENDPOINT")
                ?.trim()
                ?.takeIf { it.isNotEmpty() }
            val localAuthBypassEnabled = getenv("LUMI_LOCAL_AUTH_BYPASS").toBoolean()

            require(tokenIntrospectionEndpoint != null || localAuthBypassEnabled) {
                "Refusing to start without Texas: set LUMI_LOCAL_AUTH_BYPASS=true " +
                    "only for local development"
            }

            return ProxyConfig(
                lumiApiBaseUrl = getenv("LUMI_API_BASE_URL") ?: "http://lumi-api",
                internalSubmissionKey = getenv("LUMI_INTERNAL_SUBMISSION_KEY")
                    ?: error("LUMI_INTERNAL_SUBMISSION_KEY must be set"),
                tokenIntrospectionEndpoint = tokenIntrospectionEndpoint,
                localAuthBypassEnabled = localAuthBypassEnabled,
            )
        }
    }
}
