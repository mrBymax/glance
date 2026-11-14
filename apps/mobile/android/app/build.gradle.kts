import java.util.Properties
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

val localProps = Properties().apply {
    rootProject.file("local.properties").takeIf { it.exists() }?.inputStream()?.use { load(it) }
}
fun local(key: String, default: String): String = localProps.getProperty(key, default)

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
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    packaging { resources { excludes += "/META-INF/{AL2.0,LGPL2.1}" } }
}
kotlin { compilerOptions { jvmTarget = JvmTarget.JVM_17 } }

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
    implementation(libs.media3.exoplayer)
    implementation(libs.androidx.webkit)
    implementation(libs.androidx.biometric)
}
