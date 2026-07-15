import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    // Kotlin plugin version is controlled centrally via `kotlinVersion` in gradle.properties.
    // Keep this at 2.3.0 for now; current CodeQL (linked tools v2.24.1) does not support 2.3.10 yet.
    kotlin("jvm")
    kotlin("plugin.serialization")
    id("io.ktor.plugin") version "3.5.1"
    id("com.gradleup.shadow") version "9.5.1"
    id("com.github.ben-manes.versions") version "0.54.0"
    application
}

group = "no.nav.lumi"
version = "1.0.0"

application {
    mainClass.set("no.nav.lumi.ApplicationKt")
}

repositories {
    mavenCentral()
    maven {
        url = uri("https://github-package-registry-mirror.gc.nav.no/cached/maven-release")
    }
}

val ktorVersion = "3.5.1"
val logbackVersion = "1.5.37"
val logstashVersion = "9.0"
val postgresVersion = "42.7.13"
val hikariVersion = "7.1.0"
val flywayVersion = "12.10.0"
val kotestVersion = "6.2.2"
val mockkVersion = "1.14.11"
val testcontainersVersion = "1.21.4"
val tokenSupportVersion = "5.0.13"
val exposedVersion = "1.3.1"
val micrometerVersion = "1.17.0"
val log4jVersion = "2.26.1"
val nettyVersion = "4.2.15.Final"

dependencies {
    implementation(platform("io.netty:netty-bom:$nettyVersion"))

    // Ktor Server
    implementation("io.ktor:ktor-server-core:$ktorVersion")
    implementation("io.ktor:ktor-server-netty:$ktorVersion")
    implementation("io.ktor:ktor-server-content-negotiation:$ktorVersion")
    implementation("io.ktor:ktor-server-call-logging:$ktorVersion")
    implementation("io.ktor:ktor-server-status-pages:$ktorVersion")
    implementation("io.ktor:ktor-server-cors:$ktorVersion")
    implementation("io.ktor:ktor-server-auth:$ktorVersion")
    implementation("io.ktor:ktor-server-auth-jwt:$ktorVersion")
    implementation("io.ktor:ktor-server-double-receive:$ktorVersion")
    implementation("io.ktor:ktor-server-rate-limit:$ktorVersion")
    
    // Ktor Client (for token validation)
    implementation("io.ktor:ktor-client-core:$ktorVersion")
    implementation("io.ktor:ktor-client-cio:$ktorVersion")
    implementation("io.ktor:ktor-client-content-negotiation:$ktorVersion")

    // Resources
    implementation("io.ktor:ktor-server-resources:$ktorVersion")

    // Explorer / Metrics
    implementation("io.ktor:ktor-server-metrics-micrometer:$ktorVersion")
    implementation("io.micrometer:micrometer-registry-prometheus:$micrometerVersion")
    
    // Serialization
    implementation("io.ktor:ktor-serialization-kotlinx-json:$ktorVersion")
    
    // Database
    implementation("org.postgresql:postgresql:$postgresVersion")
    implementation("com.zaxxer:HikariCP:$hikariVersion")
    implementation("org.flywaydb:flyway-core:$flywayVersion")
    implementation("org.flywaydb:flyway-database-postgresql:$flywayVersion")

    // Exposed
    implementation("org.jetbrains.exposed:exposed-core:$exposedVersion")
    implementation("org.jetbrains.exposed:exposed-jdbc:$exposedVersion")
    implementation("org.jetbrains.exposed:exposed-java-time:$exposedVersion")
    
    // Logging
    implementation("ch.qos.logback:logback-classic:$logbackVersion")
    implementation("net.logstash.logback:logstash-logback-encoder:$logstashVersion")
    // Bridge libraries using Log4j API (e.g. Apache POI) into SLF4J/Logback.
    implementation("org.apache.logging.log4j:log4j-to-slf4j:$log4jVersion")
    
    // Excel export
    implementation("org.apache.poi:poi-ooxml:5.5.1")
    
    // Valkey/Redis cache
    implementation("redis.clients:jedis:7.5.3")
    
    // Testing
    testImplementation("io.ktor:ktor-server-test-host:$ktorVersion")
    testImplementation("io.ktor:ktor-client-mock:$ktorVersion")
    testImplementation("io.kotest:kotest-runner-junit5:$kotestVersion")
    testImplementation("io.kotest:kotest-assertions-core:$kotestVersion")
    testImplementation("io.mockk:mockk:$mockkVersion")
    testImplementation("org.testcontainers:testcontainers:$testcontainersVersion")
    testImplementation("org.testcontainers:postgresql:$testcontainersVersion")
    testImplementation("no.nav.security:mock-oauth2-server:4.0.1")
    // JUnit Jupiter API is pulled in transitively by Kotest, but the Jupiter *engine* is not.
    // Without it, plain @Test classes (e.g. NaisGraphQlClientTest) compile but are never run.
    testRuntimeOnly("org.junit.jupiter:junit-jupiter-engine")
}

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(21))
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_21)
    }
}

tasks.named<JavaExec>("run") {
    // `./gradlew run` is local dev outside NAIS — opt in to the (fail-closed)
    // local-mode auth bypass so the app starts.
    environment("LUMI_LOCAL_AUTH_BYPASS", "true")
}

tasks.withType<Test>().configureEach {
    useJUnitPlatform()
    // Tests run outside NAIS (no NAIS_CLUSTER_NAME), so explicitly opt in to the
    // local-mode auth bypass — ServerEnv.requireValidLocalAuthPolicy is fail-closed.
    environment("LUMI_LOCAL_AUTH_BYPASS", "true")
    System.getProperties()
        .filterKeys { it.toString().startsWith("lumi.perf.") }
        .forEach { (key, value) -> systemProperty(key.toString(), value) }
}

tasks {
    shadowJar {
        // mergeServiceFiles() needs INCLUDE on service descriptors so Shadow
        // concatenates all copies (e.g. Flyway 12's SPI plugin registry).
        filesMatching("META-INF/services/**") {
            duplicatesStrategy = DuplicatesStrategy.INCLUDE
        }
        mergeServiceFiles()

        archiveFileName.set("app.jar")
        archiveClassifier.set("")
        archiveVersion.set("")
    }
}
