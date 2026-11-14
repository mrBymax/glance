import org.gradle.api.tasks.testing.logging.TestExceptionFormat
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.serialization)
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}
kotlin { compilerOptions { jvmTarget = JvmTarget.JVM_17 } }

dependencies {
    api(libs.kotlinx.serialization.json)
    api(libs.okhttp)
    testImplementation(libs.junit)
    testImplementation(libs.okhttp.mockwebserver)
}

tasks.test {
    systemProperty("glance.fixtures", rootDir.resolve("../../../packages/shared/fixtures").canonicalPath)
}

// The tests in src/integrationTest need a running Glance server, so no other task depends on this one.
// scripts/integration/server-kotlin.mjs starts the server and gives its address as -Pglance.serverUrl.
testing {
    suites {
        register<JvmTestSuite>("integrationTest") {
            useJUnit(libs.versions.junit.get())
            dependencies { implementation(project()) }
            targets.all {
                testTask.configure {
                    description = "Runs the tests that need a Glance server at -Pglance.serverUrl."
                    providers.gradleProperty("glance.serverUrl").orNull?.let { systemProperty("glance.serverUrl", it) }
                    // Gradle cannot see the server as an input, so a pass of an earlier run says nothing.
                    outputs.upToDateWhen { false }
                    testLogging {
                        events("passed", "failed", "skipped")
                        exceptionFormat = TestExceptionFormat.FULL
                    }
                }
            }
        }
    }
}
