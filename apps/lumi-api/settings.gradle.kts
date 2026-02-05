pluginManagement {
    val kotlinVersion = providers.gradleProperty("kotlinVersion").get()

    resolutionStrategy {
        eachPlugin {
            if (
                requested.id.id == "org.jetbrains.kotlin.jvm" ||
                requested.id.id == "org.jetbrains.kotlin.plugin.serialization"
            ) {
                useVersion(kotlinVersion)
            }
        }
    }
}

rootProject.name = "lumi-api"
