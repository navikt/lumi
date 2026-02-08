package no.nav.lumi.config.auth

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.ktor.client.request.*
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.testing.*
import no.nav.lumi.config.AZURE_REALM
import no.nav.lumi.config.configureSerialization
import no.nav.lumi.config.configureStatusPages

class ClientAuthorizationPluginTest : FunSpec({
    val expectedClientId = "dev-gcp:team-esyfo:lumi-dashboard"
    val protectedPath = "/api/v1/intern/protected"

    test("returns 401 when principal is missing") {
        testApplication {
            application {
                configureSerialization()
                configureStatusPages()
                install(Authentication) {
                    bearer(AZURE_REALM) {
                        authenticate { null }
                    }
                }
                routing {
                    authenticate(AZURE_REALM) {
                        install(ClientAuthorizationPlugin) {
                            this.allowedClientId = expectedClientId
                        }
                        get(protectedPath) {
                            call.respond(HttpStatusCode.OK)
                        }
                    }
                }
            }

            val response = client.get(protectedPath) {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.Unauthorized
        }
    }

    test("returns 401 when clientId is null") {
        testApplication {
            application {
                configureSerialization()
                configureStatusPages()
                install(Authentication) {
                    bearer(AZURE_REALM) {
                        authenticate {
                            BrukerPrincipal(
                                navIdent = "Z123456",
                                name = "Test User",
                                email = "test@nav.no",
                                clientId = null,
                            )
                        }
                    }
                }
                routing {
                    authenticate(AZURE_REALM) {
                        install(ClientAuthorizationPlugin) {
                            this.allowedClientId = expectedClientId
                        }
                        get(protectedPath) {
                            call.respond(HttpStatusCode.OK)
                        }
                    }
                }
            }

            val response = client.get(protectedPath) {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.Unauthorized
        }
    }

    test("returns 403 when clientId is not allowed") {
        testApplication {
            application {
                configureSerialization()
                configureStatusPages()
                install(Authentication) {
                    bearer(AZURE_REALM) {
                        authenticate {
                            BrukerPrincipal(
                                navIdent = "Z123456",
                                name = "Test User",
                                email = "test@nav.no",
                                clientId = "dev-gcp:team-other:unknown-app",
                            )
                        }
                    }
                }
                routing {
                    authenticate(AZURE_REALM) {
                        install(ClientAuthorizationPlugin) {
                            this.allowedClientId = expectedClientId
                        }
                        get(protectedPath) {
                            call.respond(HttpStatusCode.OK)
                        }
                    }
                }
            }

            val response = client.get(protectedPath) {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.Forbidden
        }
    }

    test("returns 200 when clientId is allowed") {
        testApplication {
            application {
                configureSerialization()
                configureStatusPages()
                install(Authentication) {
                    bearer(AZURE_REALM) {
                        authenticate {
                            BrukerPrincipal(
                                navIdent = "Z123456",
                                name = "Test User",
                                email = "test@nav.no",
                                clientId = expectedClientId,
                            )
                        }
                    }
                }
                routing {
                    authenticate(AZURE_REALM) {
                        install(ClientAuthorizationPlugin) {
                            this.allowedClientId = expectedClientId
                        }
                        get(protectedPath) {
                            call.respond(HttpStatusCode.OK)
                        }
                    }
                }
            }

            val response = client.get(protectedPath) {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.OK
        }
    }
})
