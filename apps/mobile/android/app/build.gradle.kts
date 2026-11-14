import java.util.Properties
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

val localProps = Properties().apply {
    rootProject.file("local.properties").takeIf { it.exists() }?.inputStream()?.use { load(it) }
}

// A Gradle property wins over local.properties: ./gradlew :app:assembleDebug -Pglance.serverUrl=http://127.0.0.1:8080
fun local(key: String, default: String): String = providers.gradleProperty(key).orNull ?: localProps.getProperty(key, default)

// A time in milliseconds, as a Long of BuildConfig. The app brings it into the limits of LabelTiming in :core.
fun localMs(key: String, default: Long): String {
    val text = local(key, default.toString()).trim()
    return "${text.toLongOrNull() ?: error("$key must be a whole number of milliseconds. Got \"$text\".")}L"
}

// The name of a stream quality, as a String of BuildConfig. StreamSetup in :core has the three names.
fun localQuality(key: String, default: String): String {
    val name = local(key, default).trim().uppercase()
    if (name !in listOf("HIGH", "MEDIUM", "LOW")) error("$key must be HIGH, MEDIUM, or LOW. Got \"$name\".")
    return "\"$name\""
}

// The app brings the frame rate to a value that the DAT SDK accepts, with StreamSetup in :core.
fun localInt(key: String, default: Int): String {
    val text = local(key, default.toString()).trim()
    return (text.toIntOrNull() ?: error("$key must be a whole number. Got \"$text\".")).toString()
}

// A switch, as a boolean of BuildConfig.
fun localBool(key: String, default: Boolean): String {
    val text = local(key, default.toString()).trim().lowercase()
    if (text != "true" && text != "false") error("$key must be true or false. Got \"$text\".")
    return text
}

android {
    namespace = "com.metaglance.android"
    compileSdk = 36
    buildFeatures { buildConfig = true }
    defaultConfig {
        applicationId = "com.metaglance.android"
        minSdk = 29
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
        manifestPlaceholders["mwdat_application_id"] = local("mwdat_application_id", "0")
        manifestPlaceholders["mwdat_client_token"] = local("mwdat_client_token", "0")
        buildConfigField("String", "SERVER_URL", "\"${local("glance.serverUrl", "http://10.0.2.2:8080")}\"")
        buildConfigField("String", "UI_DEV_URL", "\"${local("glance.uiDevUrl", "")}\"")
        buildConfigField("long", "LABEL_WAIT_MS", localMs("glance.labelWaitMs", 1000))
        buildConfigField("long", "LABEL_GAP_MS", localMs("glance.labelGapMs", 6000))
        buildConfigField("String", "STREAM_QUALITY", localQuality("glance.streamQuality", "HIGH"))
        buildConfigField("int", "STREAM_FPS", localInt("glance.streamFps", 7))
        buildConfigField("boolean", "SECOND_LOOK_STILL", localBool("glance.secondLookStill", false))
        testInstrumentationRunner = "com.metaglance.android.support.GlanceTestRunner"
    }
    // The demo build is the APK for the testers: not debuggable, with no probe screen and no cleartext traffic,
    // because both are in app/src/debug. The keystore and its passwords are not in git.
    signingConfigs {
        create("demo") {
            storeFile = file(local("glance.demoStoreFile", "glance-demo.jks"))
            storePassword = local("glance.demoStorePassword", "")
            keyAlias = local("glance.demoKeyAlias", "glance-demo")
            keyPassword = local("glance.demoKeyPassword", "")
        }
    }
    buildTypes {
        create("demo") {
            isDebuggable = false
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("demo")
            matchingFallbacks += listOf("release")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    packaging { resources { excludes += "/META-INF/{AL2.0,LGPL2.1}" } }
}
kotlin { compilerOptions { jvmTarget = JvmTarget.JVM_17 } }

// Copies the build of the phone UI into the APK assets, as the folder "ui". It does not run npm.
// Without that build, the APK holds only the placeholder page.
val syncUi by tasks.registering(Sync::class) {
    from(rootDir.resolve("../ui/dist"))
    into(layout.buildDirectory.dir("generated/uiAssets/ui"))
}
android.sourceSets["main"].assets.srcDir(layout.buildDirectory.dir("generated/uiAssets"))
tasks.named("preBuild") { dependsOn(syncUi) }

dependencies {
    implementation(project(":core"))
    implementation(libs.mwdat.core)
    implementation(libs.mwdat.camera)
    implementation(libs.mwdat.motion)
    implementation(libs.mwdat.inputs)
    implementation(libs.mwdat.speech)
    implementation(libs.mwdat.mockdevice)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.activity.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.exifinterface)
    implementation(libs.mlkit.barcode)
    implementation(libs.mlkit.face)
    implementation(libs.mlkit.text)
    implementation(libs.media3.exoplayer)
    implementation(libs.androidx.webkit)
    implementation(libs.androidx.biometric)

    androidTestImplementation(libs.junit)
    androidTestImplementation(libs.androidx.test.core)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.androidx.test.rules)
    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.androidx.test.uiautomator)
}
