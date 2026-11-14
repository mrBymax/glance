# Meta Glance Plan 2: Android App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Android app of Meta Glance in `apps/mobile/android`. It connects Ray-Ban Meta Gen 2 glasses through DAT, uploads frames, detects head gestures, plays speech, and hosts the phone UI.

**Architecture:** Two Gradle modules. `:core` is pure Kotlin on the JVM: the contract mirror, the codecs, and each rule that a unit test can check. `:app` holds thin adapters for DAT, ML Kit, the audio player, and the WebView. The probe of step C1 is the first build, and its DAT code becomes the `dat` package of the app.

**Tech Stack:** Kotlin 2.2.21, Android Gradle Plugin 8.11.1, Gradle 8.14.1, DAT 1.0.1, ML Kit, OkHttp 4.12.0, kotlinx.serialization 1.9.0, coroutines 1.11.0, Media3 ExoPlayer 1.9.4, androidx.webkit 1.18.0, JUnit 4.13.2.

**Spec:** `docs/superpowers/specs/2026-11-13-meta-glance-design.md` (sections 6, 8, 9, 16). The contract is Plan 0: `docs/superpowers/plans/2026-11-14-glance-0-foundation.md`.

**Seat:** 1. One person executes this plan with coding agents and holds the only pair of glasses.

## Other plans

The author read Plans 1, 3, and 4 while they were in work. Check each statement about them against the plan file before you start the task.

| Tasks | Need | How to work before it exists |
|---|---|---|
| 1 to 4 (C1), 6, 7, 8 | Nothing | |
| 5, 9, 10, 11, 12 | Plan 0: `packages/shared/fixtures` | Do Tasks 6 to 8 first. |
| 13, 20 | Plan 3 Task 5: `npm run build --workspace @glance/phone-ui` gives `apps/mobile/ui/dist`. Its dev server uses port 5173. | The placeholder page of Task 13 loads when the build is missing. |
| 14, 15, 17 | Plan 1: a server | The fake server of Task 12. After Task 12 of Plan 1, also `npm run dev:fake --workspace @glance/server`. Both use port 8080. |
| 15, milestone M1 | Plan 1 Tasks 14, 15, and 22: recognition, clips, HTTPS. The catalog products. | Run the spine check against a fake server first. |
| 20 | Plan 4 Task 8 publishes `glance-demo.apk` as a release asset. | Give the file and its SHA-256 to seat 4. |

What the other plans get from this plan:

- Seat 2: 20 probe frames (Task 4) for the recognition test. A phone that sends frames (Task 15).
- Seat 4: the probe values `motion`, `inputs`, `speech`, `access`, and the numbers `false-yes`, `false-no`, `kiosk-distance`, `battery` (Tasks 4 and 8). The APK (Task 20).
- Seat 3: the WebView host of Task 13, the `error` events of Task 11 (the page shows `error.message`), and mock mode (Task 17).

## Machine and accounts

- Android Studio Narwhal 2025.1.1 or later with its bundled JDK, and Android SDK Platform 36. Node 22 for the fake server.
- Gradle 8.14.1 runs on JDK 17 to 24. `./gradlew --version` prints the JVM. If it prints 25 or later, select a JDK 21 in Android Studio: Settings, Build Tools, Gradle, Gradle JDK.
- Run Gradle commands in `apps/mobile/android`. PowerShell uses `.\gradlew.bat`. A terminal outside Android Studio needs `JAVA_HOME` set to `C:\Program Files\Android\Android Studio\jbr`.
- Run `adb` commands that name a device path in PowerShell. Git Bash rewrites `/sdcard/...` to a Windows path.
- An Android phone with Android 10 or later, a USB cable, the Meta AI app, and the glasses paired in the Meta AI app.
- A Meta developer account is necessary only if row 1 of the probe fails (Task 4).

## Order of work

1. Agents do Tasks 1 to 3. The human prepares the items of Task 4.
2. The human does Task 4 with the glasses. At the same time, agents do Tasks 5 to 12. These tasks change only `core/` and `tools/`, and they are independent of each other except where "Consumes" says so.
3. Tasks 13 to 15, then the spine check. Target: Saturday 13:00.
4. Tasks 16 to 20. Target: Saturday 17:00.
5. Tasks 21 to 25 are extras. Start one only when Tasks 1 to 20 are merged.

## Global Constraints

- Deadlines in Finnish time: M1 on Saturday 13:00 (a glance speaks on the glasses), feature freeze on Saturday 18:00, deadline on Sunday 08:00.
- If M1 is not reached by Saturday 14:00, cut each of Tasks 21 to 25 that the probe did not make core.
- One charge of the glasses gives about 30 minutes of stream. Each manual checklist states its stream minutes. Charge the glasses in each break. Do all other work with MockDeviceKit.
- `minSdk = 29` (Android 10), `compileSdk = 36`, `targetSdk = 36`. Application ID and namespace: `com.metaglance.android`.
- DAT 1.0.1 from Maven Central, group `com.meta.wearable`: `mwdat-core`, `mwdat-camera`, `mwdat-motion`, `mwdat-inputs`, `mwdat-speech`, `mwdat-mockdevice`. Motion, Inputs, and Speech each have their own artifact.
- Do not raise a library version. `mwdat-core` 1.0.1 depends on OkHttp 4.10.0, and `androidx.core` 1.19 needs Android Gradle Plugin 9.1.
- DAT application ID and client token are `0` (Developer Mode), read from `local.properties`. The URL scheme for Meta AI callbacks is `glance`.
- Stream: `VideoQuality.HIGH` (720 x 1280) at 7 frames per second, raw frames. Motion at 30 Hz.
- The device reserves a single tap (pause and resume) and a tap and hold (stop). No feature uses them.
- A stopped DAT session is final. Create a new session for each start. Do not restart a paused session.
- Do not start a stream while the glasses are off the face. Such a stream pauses when worn, until a tap.
- Do not open the Bluetooth microphone. The code has no `startBluetoothSco`, no `setCommunicationDevice`, no `MODE_IN_COMMUNICATION`, and no `RECORD_AUDIO`.
- Keep the app in the foreground with the screen on while a session runs. The BirdSpotter sample of Meta states that a raw stream pauses when the app leaves the foreground.
- The app never writes a frame to storage. The probe is the one exception, and it lives in `app/src/debug` only.
- The app holds no cart logic and no prices. The page has no network code.
- Type names, field names, and wire values are those of Plan 0. `:core` has no Android import and no DAT import.
- Timing values are those of `TIMING` of Plan 0. The Kotlin object `Timing` is their only copy in this app.
- Frame upload: JPEG quality 80, long side 768 pixels at most. From Task 18: crop to the center 80 percent of the width and 70 percent of the height.
- Before you write a DAT call that is not in the table "DAT surface", run `search_dat_docs` of the `wearables-dat` server with `Android` and the API name. Do not write a DAT name from memory.
- Text in code, comments, and commit messages follows `skills/anti-slop/SKILL.md`.
- Work on one branch for each step: `feat/android-c1`, `feat/android-c2`, `feat/android-c3`, and `feat/android-<extra>`. Never commit on `main`. Commit messages use `type(scope): description` as in Plans 0 and 1, with the types `feat`, `fix`, `chore`, `docs`, `test`. No Claude attribution lines.

## Review Focus

1. A clip that does not load, or a line with no clip: the shopper hears the line from the phone voice within 3 seconds, and `prompt.done` still goes out (Tasks 9 and 14).
2. A nod that starts before the prompt ends, or that answers a prompt that a new one replaced: no intent goes out (Task 10).
3. A capability that stops with no request, for example Motion after a still photo: the app starts it again at most 3 times, and `capabilities` shows its real state (Task 3).
4. A tester who denies the Android Bluetooth prompt: the app does not crash, and `setup.register` asks again (Task 16).
5. A frame whose size changes during the stream, when the glasses lower the resolution: the output follows each frame, and the header carries the real size (Task 7).

## File map

```text
apps/mobile/android/
  settings.gradle.kts, build.gradle.kts, gradle.properties, gradle/libs.versions.toml, README.md
  core/src/main/kotlin/com/metaglance/core/        pure Kotlin, tests in core/src/test
    contract/   Timing, Languages, Profile, Catalog, Cart, Events, Snapshot, Device, Bridge, Rest, Codec
    frame/      FrameCodec
    kiosk/      KioskCode, KioskDwell
    image/      RawFrame, I420, Sharpness, SharpestFramePicker, UploadGate, FrameGeometry, Pixelate, FramePrep
    gesture/    GyroSample, MotionCsv, GyroStats, HeadGestureConfig, HeadGestureDetector, GyroScript
    audio/      SpeechQueue
    input/      TouchEvent, Transcript, PromptTracker, HeadInput, MainYesResolver, KeyInput, TouchInput, VoiceInput
    state/      DatSnapshot, Revival, StateMapper, StopCauses, NativeErrors, ConnectionAnnouncer, HapticPatterns
    net/        GlanceApi, DeviceSocket, Backoff
    bridge/     Bridge
  app/src/main/kotlin/com/metaglance/android/
    dat/        DatLink, DatMapping, ProbeDecisions
    pipeline/   QrScanner, FaceFinder, FramePipeline
    audio/      PhoneVoice, ExoLinePlayer
    bridge/     WebBridge, UiAssetsHandler
    session/    ProfileStore, SessionController
    mock/       MockGlassesController, MockMenuActivity
    GlanceApp, MainActivity
  app/src/debug/kotlin/com/metaglance/android/probe/   ProbeActivity, ProbeLog
  tools/fake-server/, tools/make-sounds.mjs
```

## DAT surface

The author checked each row on the `wearables-dat` docs server (docs version 1.0) on 2026-11-14. Packages are under `com.meta.wearable.dat`.

| Area | Checked names and signatures |
|---|---|
| Start | `core.Wearables.initialize(context): DatResult<Unit, WearablesError>`. A second call fails with `ALREADY_INITIALIZED`. Read a failure with `onFailure { error, _ -> error.description }`. |
| Registration | `Wearables.startRegistration(activity)`. `Wearables.registrationState: StateFlow<RegistrationState>` with `UNAVAILABLE`, `AVAILABLE`, `REGISTERING`, `REGISTERED`, `UNREGISTERING`. `Wearables.registrationErrorStream: Flow<RegistrationError>` with `ALREADY_REGISTERED`, `ALREADY_UNREGISTERED`, `FAILED_TO_REGISTER`, `FAILED_TO_UNREGISTER`, `META_AI_NOT_INSTALLED`, `UNKNOWN`. `Wearables.handleIntent(intent) { request -> request.continueRegistration(activity) }`. |
| Permissions | `suspend Wearables.checkPermissionStatus(Permission.CAMERA): DatResult<PermissionStatus, PermissionError>`. `Permission.MICROPHONE`. `PermissionStatus.Granted`, `PermissionStatus.Denied`. `registerForActivityResult(Wearables.RequestPermissionContract())`, launched with a `Permission`, returns the same `DatResult`. `PermissionError.META_AI_NOT_INSTALLED`. |
| Devices | `Wearables.devices: StateFlow<Set<DeviceIdentifier>>`. `Wearables.devicesMetadata[id]` is a `StateFlow<Device>` or null. `core.types.Device`: `name`, `linkState`, `compatibility`, `batteryLevel` (0 means not reported), `donState`, `hingeState`, `thermalLevel`. `LinkState`: `DISCONNECTED`, `CONNECTING`, `CONNECTED`. `DonState`: `UNKNOWN`, `DOFFED`, `DONNED`. `HingeState`: `UNKNOWN`, `CLOSED`, `OPEN`. `ThermalLevel`: `UNKNOWN`, `NONE`, `LIGHT`, `MODERATE`, `SEVERE`, `CRITICAL`, `EMERGENCY`, `SHUTDOWN`. `DeviceCompatibility`: `UNDEFINED`, `COMPATIBLE`, `DEVICE_UPDATE_REQUIRED`, `SDK_UPDATE_REQUIRED`. |
| Updates | `Wearables.openDATGlassesAppUpdate(activity)` and `Wearables.openFirmwareUpdate(activity)`, each `DatResult<Unit, NavigationError>`. |
| Session | `Wearables.createSession(core.selectors.SpecificDeviceSelector(id)): DatResult<DeviceSession, DeviceSessionError>`. `core.session.DeviceSession`: `start()`, `stop()`, `state: StateFlow<DeviceSessionState>` with `IDLE`, `STARTING`, `STARTED`, `PAUSED`, `STOPPING`, `STOPPED`, `errors: SharedFlow<DeviceSessionError>`, `deviceInfo: StateFlow<Device>`. Errors that this plan reads: `NO_ELIGIBLE_DEVICE`, `DEVICE_DISCONNECTED`, `SESSION_ENDED_BY_DEVICE`, `THERMAL_CRITICAL`, `THERMAL_EMERGENCY`, `PEAK_POWER_SHUTDOWN`, `BATTERY_CRITICAL`, `DAT_APP_ON_THE_GLASSES_UPDATE_REQUIRED`, `INSUFFICIENT_SDK_VERSION`. |
| Camera | Import `camera.addCamera`. `session.addCamera(StreamConfiguration(videoQuality = VideoQuality.HIGH, frameRate = 7)): DatResult<Camera, DeviceSessionError>`. `camera.stop()`. `camera.stream.start(): DatResult<Unit, StreamError>`. `stream.state: StateFlow<StreamState>` with `STARTING`, `STARTED`, `STREAMING`, `PAUSED`, `STOPPING`, `STOPPED`, `CLOSED`. `stream.videoStream: Flow<VideoFrame>`. `stream.errorStream: Flow<StreamError>` with `STREAM_ERROR`, `CRITICAL_STREAM_ERROR`, `HINGE_CLOSED`, `PERMISSIONS_DENIED`, `THERMAL_HOT`, `BATTERY_LOW`, `PEAK_POWER_LIMIT`, `TIMEOUT`. `VideoFrame`: `buffer: ByteBuffer`, `width`, `height`, `presentationTimeUs`. `suspend stream.capturePhoto(): DatResult<PhotoData, CaptureError>` with `PhotoData.Bitmap(bitmap)` and `PhotoData.HEIC(data: ByteBuffer)`. |
| Motion | Import `motion.addMotion`, `motion.removeMotion`. `session.addMotion(MotionConfiguration(samplingRate = MotionSamplingRate.HZ_30)): DatResult<Motion, DeviceSessionError>`. `motion.start()`, `motion.stop()`. `motion.state: StateFlow<MotionState>` with `STOPPED`, `STARTING`, `STARTED`, `STOPPING`, `PAUSED`. `motion.samples: Flow<MotionSample>` has no replay: collect it with `CoroutineStart.UNDISPATCHED` before `start()`. `motion.errors: StateFlow<MotionError?>`. `MotionSample`: `timestampNs: Long`, `accelerometer`, `gyroscope`, `magnetometer` as `Vector3?` (`x`, `y`, `z: Float`), `orientation: Quaternion?`. Gyroscope values are rad/s. |
| Inputs | Import `inputs.addInputs`, `inputs.removeInputs`. `session.addInputs(InputsConfiguration(sources = setOf(InputSource.CAPTOUCH), consumeBack = true))`. It starts by itself. `inputs.state: StateFlow<InputsState>` with `INACTIVE`, `ACTIVATING`, `ACTIVE`, `DEACTIVATING`. `inputs.errors: StateFlow<InputsError?>`. `inputs.events: Flow<InputEvent>`. A double tap is `InputEvent.Select`. A swipe is `InputEvent.Nav`. |
| Speech | Import `speech.addSpeech`, `speech.removeSpeech`. `session.addSpeech(): DatResult<Speech, DeviceSessionError>`. `speech.start(): DatResult<Unit, SpeechError>`, `speech.stop()`. `speech.state: StateFlow<SpeechState>` with `STARTING`, `STARTED`, `STOPPING`, `STOPPED`. `speech.transcriptions: StateFlow<TranscriptionResult?>` with `text`, `isFinal`, `confidence: Float` (-1 means none). `speech.locale: StateFlow<String?>`. `speech.errors: StateFlow<SpeechError?>`. It needs `Permission.MICROPHONE`. |
| MockDeviceKit | `mockdevice.MockDeviceKit.getInstance(context)`: `enable(MockDeviceKitConfig(initiallyRegistered = true, initialPermissionsGranted = true))`, `disable()`, `isEnabled`, `simulateRegistrationOutcome(success)`, `pairGlasses(GlassesModel.RAYBAN_META): DatResult<MockGlasses, MockDeviceKitError>`, `permissions.set(permission, status)`, `permissions.setRequestResult(permission, status)`. `mockdevice.api.MockGlasses`: `powerOn()`, `powerOff()`, `don()`, `doff()`, `fold()`, `unfold()`, `setBatteryLevel(Int)`, `setThermalLevel(ThermalLevel)`. `glasses.services`: `camera.setCameraFeed(CameraFacing.BACK)`, `camera.setCapturedImage(uri)`, `captouch.tap()`, `captouch.tapAndHold()`, `input.select(InputSource.CAPTOUCH)`, `input.navDown()`, `motion.setMotionFeed(samples, loop)`, `motion.setMotionFeed(fileUri)`, `speech.simulateTranscription(text, isFinal, confidence)`. `CameraFacing` is in `mockdevice.api.camera`. |

Facts that the docs do not state:

| Open fact | Where this plan settles it |
|---|---|
| Motion, Inputs, and Speech with app ID `0`. The README of the BirdSpotter sample of Meta says that `0` is enough. | Task 4, rows 6 to 8 |
| The layout of `VideoFrame.buffer`. The docs say "YUV". The CameraAccess sample of release 0.8.0 reads it as I420 with BT.709 limited range. | Task 2 mock check 4, Task 4 row 5 |
| The axes of the gyroscope and the sign of "down". | Task 4, row 10 |
| Audio that the app plays goes to the glasses with no SDK call. The docs show an iOS example only. | Task 4, row 9 |
| The size and the time of `capturePhoto()` on Android. BirdSpotter restarts Motion, Inputs, and Speech after a still. | Task 4, row 11 |
| A pause on doff, and a stream that starts off the face. | Task 4, rows 13 and 16 |
| Motion with no camera stream. | Task 4, row 19 |
| The minimum Meta AI app and firmware versions for SDK 1.0.1. The search gave the 1.0.0 table: app V290, glasses V128. | Task 4, preparation |
| MockDeviceKit has no call for a stream error, for device compatibility, or for a missing Meta AI app. | Task 17 uses force items |
| The error that `simulateRegistrationOutcome(false)` emits. | Task 17, row 3 |
| `speech.transcriptions` is a `StateFlow`. Two equal results in a row arrive one time. | Task 23, glasses check |

---

### Task 1 [C1]: Gradle project, motion CSV, probe screen

**Files:**
- Create: `apps/mobile/android/settings.gradle.kts`, `build.gradle.kts`, `gradle.properties`, `gradle/libs.versions.toml`, the Gradle wrapper, `README.md`
- Create: `core/build.gradle.kts`, `core/src/main/kotlin/com/metaglance/core/contract/Timing.kt`, `core/src/main/kotlin/com/metaglance/core/gesture/GyroSample.kt`, `core/src/main/kotlin/com/metaglance/core/gesture/MotionCsv.kt`
- Test: `core/src/test/kotlin/com/metaglance/core/gesture/MotionCsvTest.kt`
- Create: `app/build.gradle.kts`, `app/src/main/AndroidManifest.xml`, `app/src/debug/AndroidManifest.xml`, `app/src/main/kotlin/com/metaglance/android/GlanceApp.kt`, `app/src/debug/kotlin/com/metaglance/android/probe/ProbeActivity.kt`, `app/src/debug/kotlin/com/metaglance/android/probe/ProbeLog.kt`
- Delete: `apps/mobile/.gitkeep`, if it still exists

**Interfaces:**
- Consumes: nothing.
- Produces:

```kotlin
// core: com.metaglance.core.contract
object Timing { const val kioskDwellMs = 1500L; const val uploadEveryMs = 500L; const val speechMuteAfterClipMs = 500L; const val headWindowMs = 8000L }

// core: com.metaglance.core.gesture
data class GyroSample(val tNs: Long, val x: Float, val y: Float, val z: Float)   // rad/s, clock of the glasses
data class MotionRow(val tNs: Long,
    val accelX: Float, val accelY: Float, val accelZ: Float, val gyroX: Float, val gyroY: Float, val gyroZ: Float,
    val magX: Float, val magY: Float, val magZ: Float,
    val orientationW: Float, val orientationX: Float, val orientationY: Float, val orientationZ: Float)
object MotionCsv {
    fun format(row: MotionRow): String              // one line, no line break
    fun parse(text: String): List<MotionRow>
    fun gyro(rows: List<MotionRow>): List<GyroSample>
}

// app, debug: com.metaglance.android.probe
class ProbeLog(dir: File) { val file: File; fun line(message: String) }   // also Logcat tag "Glance"
```

`MotionCsv` is the MockDeviceKit format: no header row, 14 values, comma-separated, in the field order of `MotionRow`. Blank lines and lines that start with `#` are skipped.

- [ ] **Step 1: Create the project with Android Studio**

```bash
git switch -c feat/android-c1
```

New Project, "No Activity". Name `Glance`, package `com.metaglance.android`, save location `apps/mobile/android`, language Kotlin, minimum SDK API 29, build configuration language Kotlin DSL. The wizard writes the Gradle wrapper and `local.properties`. Delete `app/src/test` and `app/src/androidTest`. Then replace the build files with the files of Step 2. Decline each upgrade that Android Studio offers.

- [ ] **Step 2: Write the build files**

`gradle/wrapper/gradle-wrapper.properties`: `distributionUrl=https\://services.gradle.org/distributions/gradle-8.14.1-bin.zip`

`gradle/libs.versions.toml`:

```toml
[versions]
agp = "8.11.1"
kotlin = "2.2.21"
mwdat = "1.0.1"
coroutines = "1.11.0"
serialization = "1.9.0"
okhttp = "4.12.0"
mlkitBarcode = "17.3.0"
mlkitFace = "16.1.7"
media3 = "1.9.4"
webkit = "1.18.0"
biometric = "1.1.0"
appcompat = "1.7.1"
activity = "1.12.4"
lifecycle = "2.10.0"
exifinterface = "1.4.2"
junit = "4.13.2"

[libraries]
mwdat-core = { group = "com.meta.wearable", name = "mwdat-core", version.ref = "mwdat" }
mwdat-camera = { group = "com.meta.wearable", name = "mwdat-camera", version.ref = "mwdat" }
mwdat-motion = { group = "com.meta.wearable", name = "mwdat-motion", version.ref = "mwdat" }
mwdat-inputs = { group = "com.meta.wearable", name = "mwdat-inputs", version.ref = "mwdat" }
mwdat-speech = { group = "com.meta.wearable", name = "mwdat-speech", version.ref = "mwdat" }
mwdat-mockdevice = { group = "com.meta.wearable", name = "mwdat-mockdevice", version.ref = "mwdat" }
kotlinx-coroutines-android = { group = "org.jetbrains.kotlinx", name = "kotlinx-coroutines-android", version.ref = "coroutines" }
kotlinx-serialization-json = { group = "org.jetbrains.kotlinx", name = "kotlinx-serialization-json", version.ref = "serialization" }
okhttp = { group = "com.squareup.okhttp3", name = "okhttp", version.ref = "okhttp" }
okhttp-mockwebserver = { group = "com.squareup.okhttp3", name = "mockwebserver", version.ref = "okhttp" }
mlkit-barcode = { group = "com.google.mlkit", name = "barcode-scanning", version.ref = "mlkitBarcode" }
mlkit-face = { group = "com.google.mlkit", name = "face-detection", version.ref = "mlkitFace" }
media3-exoplayer = { group = "androidx.media3", name = "media3-exoplayer", version.ref = "media3" }
androidx-webkit = { group = "androidx.webkit", name = "webkit", version.ref = "webkit" }
androidx-biometric = { group = "androidx.biometric", name = "biometric", version.ref = "biometric" }
androidx-appcompat = { group = "androidx.appcompat", name = "appcompat", version.ref = "appcompat" }
androidx-activity-ktx = { group = "androidx.activity", name = "activity-ktx", version.ref = "activity" }
androidx-lifecycle-runtime-ktx = { group = "androidx.lifecycle", name = "lifecycle-runtime-ktx", version.ref = "lifecycle" }
androidx-exifinterface = { group = "androidx.exifinterface", name = "exifinterface", version.ref = "exifinterface" }
junit = { group = "junit", name = "junit", version.ref = "junit" }

[plugins]
android-application = { id = "com.android.application", version.ref = "agp" }
kotlin-android = { id = "org.jetbrains.kotlin.android", version.ref = "kotlin" }
kotlin-jvm = { id = "org.jetbrains.kotlin.jvm", version.ref = "kotlin" }
kotlin-serialization = { id = "org.jetbrains.kotlin.plugin.serialization", version.ref = "kotlin" }
```

Android Gradle Plugin 8.11.1, Kotlin 2.2.21, and Gradle 8.14.1 are the versions of the CameraAccess sample of Meta for DAT 1.0.1.

`settings.gradle.kts`: `pluginManagement` with `google()`, `mavenCentral()`, `gradlePluginPortal()`. `dependencyResolutionManagement` with `google()` and `mavenCentral()`. `rootProject.name = "Glance"`. `include(":app", ":core")`.

Root `build.gradle.kts`: the four plugins of the catalog, each with `apply false`.

`gradle.properties` holds only these four lines: `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8`, `android.useAndroidX=true`, `kotlin.code.style=official`, `android.nonTransitiveRClass=true`. Delete `gradle/gradle-daemon-jvm.properties` if the wizard wrote it. It can ask for a JDK that this build cannot download.

`core/build.gradle.kts`:

```kotlin
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
```

`app/build.gradle.kts`:

```kotlin
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
```

MockDeviceKit runs inside the app, so `mwdat-mockdevice` is an `implementation` dependency of each build type. `ACCESS_NETWORK_STATE` in the manifest below is one permission more than spec section 9.10 lists. The `network` field needs it.

`app/src/main/AndroidManifest.xml`:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.BLUETOOTH" />
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <!-- Only the MockDeviceKit feed from the phone camera uses this permission. -->
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-feature android:name="android.hardware.camera" android:required="false" />

    <application android:name=".GlanceApp" android:label="Glance" android:allowBackup="false"
        android:theme="@style/Theme.AppCompat.DayNight.NoActionBar">
        <meta-data android:name="com.meta.wearable.mwdat.APPLICATION_ID" android:value="${mwdat_application_id}" />
        <meta-data android:name="com.meta.wearable.mwdat.CLIENT_TOKEN" android:value="${mwdat_client_token}" />
    </application>
</manifest>
```

`app/src/debug/AndroidManifest.xml`: `<application android:usesCleartextTraffic="true">` with one activity, `.probe.ProbeActivity`: `exported="true"`, label `Glance Probe`, `screenOrientation="portrait"`, `launchMode="singleTask"`, a launcher intent filter, and a second filter with `VIEW`, `DEFAULT`, `BROWSABLE`, and `<data android:scheme="glance" />`.

- [ ] **Step 3: Write the failing test**

`MotionCsvTest.kt`:

```kotlin
private val row = MotionRow(500000000, 0f, 9.81f, 0f, 0.34f, -0.02f, 0f, 0f, 0f, 0f, 1f, 0f, 0f, 0f)

@Test fun `formats one row as 14 values in the MockDeviceKit order`() {
    assertEquals("500000000,0.0,9.81,0.0,0.34,-0.02,0.0,0.0,0.0,0.0,1.0,0.0,0.0,0.0", MotionCsv.format(row))
}
@Test fun `parses what it formats`() { assertEquals(listOf(row), MotionCsv.parse(MotionCsv.format(row))) }
@Test fun `skips blank lines and comment lines`() {
    assertEquals(2, MotionCsv.parse("# five nods\n\n${MotionCsv.format(row)}\n${MotionCsv.format(row)}\n").size)
}
@Test fun `rejects a row that does not have 14 values`() {
    assertThrows(IllegalArgumentException::class.java) { MotionCsv.parse("1,2,3") }
}
@Test fun `reads the gyroscope columns`() {
    assertEquals(listOf(GyroSample(500000000, 0.34f, -0.02f, 0f)), MotionCsv.gyro(listOf(row)))
}
```

- [ ] **Step 4: Run the test and make sure it fails**

Run: `./gradlew :core:test --tests "*MotionCsvTest"`
Expected: FAIL at compile time, because `MotionCsv` does not exist.

- [ ] **Step 5: Implement `Timing`, `GyroSample`, `MotionRow`, `MotionCsv`**

Write each number with `toString()`. A locale format writes a decimal comma on a Finnish or Italian phone.

- [ ] **Step 6: Write `GlanceApp`, `ProbeLog`, and the `ProbeActivity` shell**

- `GlanceApp` is the `Application`. It holds one app-wide `CoroutineScope` (`SupervisorJob` and `Dispatchers.Main`). It does not call `Wearables.initialize`.
- `ProbeLog.line` writes `HH:mm:ss.SSS <message>` to the screen, to Logcat with the tag `Glance`, and to `getExternalFilesDir("probe")/probe-<start time>.log`.
- `ProbeActivity` is an `AppCompatActivity`. Build the layout in code: a scroll list of buttons above a scroll view with a monospace log. No XML layout, no Compose. A helper `addButton(label: String, onClick: () -> Unit)` adds one button. Later tasks add buttons with it.
- At start it logs `probe ready sdk=<Build.VERSION.SDK_INT> appId=<manifest value>`.

- [ ] **Step 7: Run all checks**

Run: `./gradlew --version`, then `./gradlew :core:test :app:assembleDebug`
Expected: a JVM from 17 to 24, 5 tests pass, and `BUILD SUCCESSFUL`.

Run: `./gradlew :app:installDebug` with a phone or an emulator connected, then open "Glance Probe".
Expected: the log shows `probe ready sdk=<n> appId=0`.

- [ ] **Step 8: Write `README.md` and commit**

`README.md` has four short parts: machine needs, the build commands, the `local.properties` keys (`mwdat_application_id`, `mwdat_client_token`, `glance.serverUrl`, `glance.uiDevUrl`), and the two notes about JDK and `adb` of "Machine and accounts".

```bash
git rm --ignore-unmatch apps/mobile/.gitkeep
git add apps/mobile/android
git commit -m "chore(android): add the Gradle project, the motion CSV format, and the probe screen"
```

---

### Task 2 [C1]: Probe link: registration, session, stream, frames

**Files:**
- Create: `core/src/main/kotlin/com/metaglance/core/state/DatSnapshot.kt`, `core/src/main/kotlin/com/metaglance/core/image/RawFrame.kt`, `core/src/main/kotlin/com/metaglance/core/image/I420.kt`
- Test: `core/src/test/kotlin/com/metaglance/core/image/I420Test.kt`
- Create: `app/src/main/kotlin/com/metaglance/android/dat/DatLink.kt`, `dat/DatMapping.kt`, `pipeline/QrScanner.kt`, `mock/MockGlassesController.kt`
- Modify: `app/src/main/kotlin/com/metaglance/android/GlanceApp.kt`, `app/src/debug/kotlin/com/metaglance/android/probe/ProbeActivity.kt`

**Interfaces:**
- Consumes: `ProbeLog`, `ProbeActivity.addButton` (Task 1).
- Produces:

```kotlin
// core: com.metaglance.core.state. The constants have the names of the SDK enums.
enum class DatRegistration { UNAVAILABLE, AVAILABLE, REGISTERING, REGISTERED, UNREGISTERING }
enum class DatPermission { UNKNOWN, GRANTED, DENIED }
enum class DatLinkState { DISCONNECTED, CONNECTING, CONNECTED }
enum class DatDon { UNKNOWN, DOFFED, DONNED }
enum class DatHinge { UNKNOWN, CLOSED, OPEN }
enum class DatThermal { UNKNOWN, NONE, LIGHT, MODERATE, SEVERE, CRITICAL, EMERGENCY, SHUTDOWN }
enum class DatCompatibility { UNDEFINED, COMPATIBLE, DEVICE_UPDATE_REQUIRED, SDK_UPDATE_REQUIRED }
enum class DatSession { NONE, IDLE, STARTING, STARTED, PAUSED, STOPPING, STOPPED }
enum class DatStream { NONE, STARTING, STARTED, STREAMING, PAUSED, STOPPING, STOPPED, CLOSED }
data class DatDevice(val name: String, val link: DatLinkState, val compatibility: DatCompatibility,
    val battery: Int, val don: DatDon, val hinge: DatHinge, val thermal: DatThermal)   // battery 0 = not reported
data class DatSnapshot(val bluetoothGranted: Boolean, val metaAiInstalled: Boolean, val registration: DatRegistration,
    val cameraPermission: DatPermission, val microphonePermission: DatPermission, val device: DatDevice?,
    val session: DatSession, val stream: DatStream,
    val motionStarted: Boolean, val inputsActive: Boolean, val speechStarted: Boolean,
    val glassesAppUpdateRequired: Boolean, val mock: Boolean)
data class DatFault(val area: Area, val name: String) {      // name = the name of the SDK error constant
    enum class Area { REGISTRATION, PERMISSION, SESSION, STREAM, MOTION, INPUTS, SPEECH, CAPTURE }
}

// core: com.metaglance.core.image
class RawFrame(val i420: ByteArray, val width: Int, val height: Int, val tUs: Long)
object I420 { fun toNv21(i420: ByteArray, width: Int, height: Int): ByteArray }

// app: com.metaglance.android.dat
class DatLink(app: Application, scope: CoroutineScope, log: (String) -> Unit) {
    val snapshot: StateFlow<DatSnapshot>
    val faults: SharedFlow<DatFault>
    val frames: SharedFlow<RawFrame>       // newest frame only: replay 0, extraBufferCapacity 1, DROP_OLDEST
    fun initialize(bluetoothGranted: Boolean)                 // safe to call again
    fun register(activity: Activity)
    suspend fun refreshPermissions()                          // camera and microphone
    fun onPermissionResult(permission: Permission, status: PermissionStatus?)   // null = the request failed
    fun startSession(withCamera: Boolean = true, autoAttach: Boolean = false): Boolean   // false: no connected device
    fun stopSession()                                         // camera first, then the session
    fun openUpdate(activity: Activity)
}

// app: com.metaglance.android.mock
class MockGlassesController(context: Context) {
    val enabled: Boolean
    val glasses: MockGlasses?
    fun enable(registered: Boolean = true); fun disable()
    fun pair(): Boolean              // RAYBAN_META, then powerOn, unfold, don
    fun usePhoneCamera()             // CameraFacing.BACK. The caller gets android.permission.CAMERA first.
}

// app: com.metaglance.android.pipeline
class QrHit(val text: String, val areaPx: Int)
class QrScanner { fun scan(nv21: ByteArray, width: Int, height: Int): List<QrHit>; fun close() }   // blocks, QR codes only
```

`GlanceApp` owns one `DatLink` and one `MockGlassesController`. The probe and, later, the app use the same two objects.

Rules for `DatLink`:

1. `initialize(true)` calls `Wearables.initialize(app)` one time and treats `ALREADY_INITIALIZED` as success. `initialize(false)` only sets `bluetoothGranted = false`. With MockDeviceKit enabled, skip the call: `enable()` initializes the SDK.
2. Collect `Wearables.registrationState`, `Wearables.registrationErrorStream`, and `Wearables.devices` for the life of the app.
3. Device choice: the first identifier of `Wearables.devices.value` whose `devicesMetadata[id]?.value?.linkState` is `CONNECTED`. With none, take the first identifier. Collect its metadata flow into `snapshot.device`.
4. `startSession` creates the session with `SpecificDeviceSelector(id)` for a connected device. Do not build an `AutoDeviceSelector` at the tap. BirdSpotter reports that it is still empty then, and the session fails with `NO_ELIGIBLE_DEVICE`.
5. Collect `session.state`, `session.errors`, and `session.deviceInfo` before `session.start()`.
6. On the first `STARTED`, if `withCamera`: `addCamera` with the stream configuration of Global Constraints. Collect `stream.state`, `stream.errorStream`, and `stream.videoStream`. Then `stream.start()`.
7. In the frame collector, copy `frame.buffer` into a new `ByteArray` and restore the buffer position, before any suspension. Expect `width * height * 3 / 2` bytes in I420 layout: Y plane, U plane, V plane. Log one line when the size differs.
8. `stopSession`: `camera.stop()`, then `session.stop()`. Cancel the collectors. Drop both references. Set `session` and `stream` in the snapshot from the last SDK values.
9. `metaAiInstalled` starts as `true`. `META_AI_NOT_INSTALLED` from registration, permission, or navigation sets it to `false`. `REGISTERING` or `REGISTERED` sets it to `true`.
10. `glassesAppUpdateRequired` becomes `true` on the session error `DAT_APP_ON_THE_GLASSES_UPDATE_REQUIRED`.
11. `openUpdate` calls `openDATGlassesAppUpdate` when `glassesAppUpdateRequired` is true, else `openFirmwareUpdate`.
12. `DatMapping` maps each SDK enum to the `:core` enum by constant name.
13. Log each state change and each error as one line: `registration REGISTERED`, `device <name> link=CONNECTED battery=80 don=DONNED hinge=OPEN thermal=NONE`, `session STARTED`, `stream STREAMING`, `stream error THERMAL_HOT`. Log `frame 720x1280 #<count> fps=<measured>` one time each second.

`QrScanner` uses `BarcodeScanning.getClient` with `Barcode.FORMAT_QR_CODE`, `InputImage.fromByteArray(nv21, width, height, 0, InputImage.IMAGE_FORMAT_NV21)`, and `Tasks.await`. `areaPx` is the area of `boundingBox`.

- [ ] **Step 1: Write the failing test**

`I420Test.kt`:

```kotlin
@Test fun `puts V and U in pairs after the Y plane`() {
    // 4 x 2 frame: 8 Y bytes, 2 U bytes, 2 V bytes
    val i420 = byteArrayOf(1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 20, 21)
    assertArrayEquals(byteArrayOf(1, 2, 3, 4, 5, 6, 7, 8, 20, 10, 21, 11), I420.toNv21(i420, 4, 2))
}
@Test fun `rejects a buffer that is shorter than the frame`() {
    assertThrows(IllegalArgumentException::class.java) { I420.toNv21(ByteArray(11), 4, 2) }
}
@Test fun `ignores bytes after the frame`() { assertEquals(12, I420.toNv21(ByteArray(20), 4, 2).size) }
```

- [ ] **Step 2: Run the test and make sure it fails**

Run: `./gradlew :core:test --tests "*I420Test"`
Expected: FAIL at compile time, because `I420` does not exist.

- [ ] **Step 3: Implement the `:core` types, `I420.toNv21`, `DatLink`, `DatMapping`, `QrScanner`, `MockGlassesController`**

- [ ] **Step 4: Add the probe buttons**

| Button | Action |
|---|---|
| `Bluetooth permission` | Request `BLUETOOTH_CONNECT` on Android 12 or later, then `DatLink.initialize(granted)`. Log `bluetooth granted` and `dat initialized`. |
| `Register` | `DatLink.register(this)` |
| `Camera permission`, `Mic permission` | Launch `Wearables.RequestPermissionContract()` with the permission. Give the result to `onPermissionResult`. |
| `Start session`, `Start session (no camera)`, `Stop session` | `startSession(withCamera = true or false)`, `stopSession()` |
| `Save frame`, with a text field for the label | Save the next frame as `probe/frames/<label>-<nn>.jpg`: `I420.toNv21`, then `YuvImage.compressToJpeg` at quality 95, full frame. |
| `QR log` | A switch. While on, scan each frame and log `qr "<text>" area=<px>`, at most 2 lines each second. |
| `Mock: enable and pair`, `Mock: phone camera`, `Mock: disable` | `MockGlassesController`. `Mock: phone camera` asks for the Android camera permission first. |

- [ ] **Step 5: Run the test and the build**

Run: `./gradlew :core:test :app:assembleDebug`
Expected: PASS and `BUILD SUCCESSFUL`.

- [ ] **Step 6: Check with MockDeviceKit**

Use a phone or an emulator. No glasses.

| # | Do | Expected |
|---|---|---|
| 1 | Tap `Mock: enable and pair`. | `registration REGISTERED`, and one `device` line with `link=CONNECTED don=DONNED hinge=OPEN`. |
| 2 | Tap `Mock: phone camera`. Allow the camera. | No error line. |
| 3 | Tap `Start session`. | Within 5 seconds: `session STARTED`, `stream STREAMING`, and `frame` lines with a size and a rate near 7. |
| 4 | Type `test`, tap `Save frame`. Pull the file with `adb pull` and open it. | The picture has natural colors. Swapped or green colors mean that the buffer is not I420: stop and report. |
| 5 | Show a QR code with the text `GL1 K3X7` (`npx qrcode -o gl1.png "GL1 K3X7"`). Enable `QR log`. | `qr "GL1 K3X7" area=<px>` |
| 6 | Tap `Stop session`, then `Start session`. | `session STOPPED`, then a new session reaches `STREAMING`. |

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/android
git commit -m "feat(android): add the DAT link with session, stream, and frame capture to the probe"
```

---

### Task 3 [C1]: Probe capabilities: Motion, Inputs, Speech, audio, still

**Files:**
- Create: `core/src/main/kotlin/com/metaglance/core/gesture/GyroStats.kt`, `core/src/main/kotlin/com/metaglance/core/state/Revival.kt`, `core/src/main/kotlin/com/metaglance/core/input/TouchEvent.kt`, `core/src/main/kotlin/com/metaglance/core/input/Transcript.kt`
- Test: `core/src/test/kotlin/com/metaglance/core/gesture/GyroStatsTest.kt`, `core/src/test/kotlin/com/metaglance/core/state/RevivalTest.kt`
- Create: `app/src/main/kotlin/com/metaglance/android/audio/PhoneVoice.kt`, `app/src/main/kotlin/com/metaglance/android/dat/ProbeDecisions.kt`
- Modify: `app/src/main/kotlin/com/metaglance/android/dat/DatLink.kt`, `app/src/debug/kotlin/com/metaglance/android/probe/ProbeActivity.kt`

**Interfaces:**
- Consumes: `DatLink`, `MockGlassesController` (Task 2). `GyroSample`, `MotionRow`, `MotionCsv` (Task 1).
- Produces:

```kotlin
// app: com.metaglance.android.dat. These are the defaults. Task 4 replaces them with the measured values.
object ProbeDecisions {
    const val MOTION = true
    const val INPUTS = true
    const val SPEECH = false
    val INPUT_SOURCES: Set<InputSource> = setOf(InputSource.CAPTOUCH)
    val PITCH_AXIS = Axis.X
    const val PITCH_DOWN_SIGN = 1
    val YAW_AXIS = Axis.Y
    const val MOTION_NEEDS_STREAM = true
}

// core
enum class Axis { X, Y, Z }
class AxisReport(val rmsX: Float, val rmsY: Float, val rmsZ: Float, val strongest: Axis, val firstSign: Int)
object GyroStats { fun report(samples: List<GyroSample>, startRadS: Float = 0.8f): AxisReport }
// firstSign: the sign of the first sample on the strongest axis whose size is startRadS or more. 0 if none.
class Revival(private val maxAttempts: Int = 3) {
    fun onStarted()                           // the capability runs. The attempt count goes back to 0.
    fun onStopped(byApp: Boolean): Boolean    // true = start it again now
}
enum class TouchEvent { DOUBLE_TAP, SWIPE }
data class Transcript(val text: String, val isFinal: Boolean, val confidence: Float?, val locale: String?)

// app: added to DatLink
val gyro: SharedFlow<GyroSample>            // samples that carry a gyroscope reading
val motionRows: SharedFlow<MotionRow>       // for the recorder. A missing reading is 0. A missing orientation is 1,0,0,0.
val touches: SharedFlow<TouchEvent>
val transcripts: SharedFlow<Transcript>
fun attachMotion(); fun attachInputs(sources: Set<InputSource>); fun attachSpeech()
suspend fun captureStill(): Bitmap?         // null on failure. The fault goes to `faults`.

// app: com.metaglance.android.audio
class PhoneVoice(context: Context) {        // Android TextToSpeech, USAGE_MEDIA, Locale.US
    val ready: Boolean
    fun speak(text: String, rate: Float = 1f, onEnd: () -> Unit)   // onEnd runs one time, also after an error
    fun stop()
}
```

Rules for the capabilities:

1. Motion: `addMotion` at 30 Hz. Collect `samples` with `CoroutineStart.UNDISPATCHED`, then `state` and `errors`, then call `motion.start()`.
2. Inputs: `addInputs` with the given sources and `consumeBack = true`. `InputEvent.Select` gives `DOUBLE_TAP`. `InputEvent.Nav` gives `SWIPE`. Ignore each other event. Keep the `when` exhaustive.
3. Speech: only when `microphonePermission` is `GRANTED`. `addSpeech`, collect `transcriptions`, `state`, `locale`, and `errors`, then `speech.start()`. A confidence below 0 becomes `null`.
4. Revive, with one `Revival` for each capability. Motion or Speech that reaches `STOPPED` after `STARTED`, with no request from the app: wait 750 ms, then `start()`. Inputs that reaches `INACTIVE` after `ACTIVE`: `removeInputs()`, then `addInputs` again. Log each revival.
5. `snapshot.motionStarted` is true only in `MotionState.STARTED`. `inputsActive` is true only in `InputsState.ACTIVE`. `speechStarted` is true only in `SpeechState.STARTED`.
6. `startSession(autoAttach = true)` attaches the capabilities that `ProbeDecisions` names, after the first `STREAMING`. BirdSpotter attaches its sensors at the same point. The probe uses `autoAttach = false`.
7. `captureStill`: `PhotoData.Bitmap` gives its bitmap. `PhotoData.HEIC` gives the bytes: decode them with `BitmapFactory`, then apply the EXIF rotation with `ExifInterface`. The CameraAccess sample does the same.
8. Log lines: `motion STARTED`, `motion samples=<count>` each 3 seconds, `inputs ACTIVE`, `touch DOUBLE_TAP`, `speech STARTED locale=en_US`, `transcript "add" final 0.9`, `still 1440x1080 Bitmap 950 ms`, `revive motion 1`.

- [ ] **Step 1: Write the failing tests**

`GyroStatsTest.kt`:

```kotlin
@Test fun `names the axis with the most motion and the sign of its first excursion`() {
    val y = listOf(0f, 0.2f, -1.0f, -1.2f, 1.1f, 0.9f)
    val report = GyroStats.report(y.mapIndexed { i, v -> GyroSample(i * 33_000_000L, 0.1f, v, 0f) })
    assertEquals(Axis.Y, report.strongest)
    assertEquals(-1, report.firstSign)
    assertEquals(0.1f, report.rmsX, 0.001f)
}
@Test fun `gives sign 0 when no sample reaches the start rate`() {
    assertEquals(0, GyroStats.report(listOf(GyroSample(0, 0.1f, 0.2f, 0f))).firstSign)
}
```

`RevivalTest.kt` (Review Focus 3):

```kotlin
@Test fun `does not start a capability that never ran`() { assertFalse(Revival().onStopped(byApp = false)) }
@Test fun `starts a capability again at most 3 times`() {
    val r = Revival(); r.onStarted()
    assertEquals(listOf(true, true, true, false), List(4) { r.onStopped(byApp = false) })
}
@Test fun `a new start resets the count`() {
    val r = Revival(); r.onStarted()
    repeat(3) { r.onStopped(false) }
    r.onStarted()
    assertTrue(r.onStopped(false))
}
@Test fun `does not start again after a stop by the app`() {
    val r = Revival(); r.onStarted()
    assertFalse(r.onStopped(byApp = true))
}
```

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `./gradlew :core:test --tests "*GyroStatsTest" --tests "*RevivalTest"`
Expected: FAIL at compile time.

- [ ] **Step 3: Implement the `:core` units, the capabilities in `DatLink`, and `PhoneVoice`**

- [ ] **Step 4: Add the probe buttons**

| Button | Action |
|---|---|
| `Motion`, `Inputs`, `Speech` | `attachMotion()`, `attachInputs(setOf(InputSource.CAPTOUCH))`, `attachSpeech()` |
| `Speak line` | Speak "Oat drink, one litre, one eighty-nine. Nod to add." with `PhoneVoice`. Log the frame size before and after. Log the types of `AudioManager.getDevices(GET_DEVICES_OUTPUTS)`. Log each transcript that arrives during the line. |
| `Axis test` | Collect `gyro` for 4 seconds. Log `axis rms x=.. y=.. z=.. strongest=.. firstSign=..` from `GyroStats.report`. |
| `Still` | `captureStill()`. Log the size, the variant, and the milliseconds. |
| `Record motion`, with the label field | A switch. While on, append `MotionCsv.format` of each row to `probe/motion/<label>.csv`. |
| `Endurance 10 min` | For 10 minutes: speak the line each 30 seconds. Each minute log `battery`, `thermal`, the frame count, the frame size, and the motion sample count. |
| `Mock: motion`, `Mock: double tap`, `Mock: swipe`, `Mock: say add`, `Mock: still image` | `motion.setMotionFeed` with 60 samples of `gyroscope = Vector3(1f, 0f, 0f)` and `loop = true`. `input.select(InputSource.CAPTOUCH)`. `input.navDown()`. `speech.simulateTranscription("add", isFinal = true, confidence = 0.9f)`. `camera.setCapturedImage` with a saved frame of Task 2. |

- [ ] **Step 5: Run the tests and the build**

Run: `./gradlew :core:test :app:assembleDebug`
Expected: PASS and `BUILD SUCCESSFUL`.

- [ ] **Step 6: Check with MockDeviceKit**

Start a mock session as in Task 2.

| # | Do | Expected |
|---|---|---|
| 1 | Tap `Motion`, then `Mock: motion`, then `Axis test`. | `motion STARTED`, a rising sample count, `strongest=X firstSign=1`. |
| 2 | Tap `Inputs`, `Mock: double tap`, `Mock: swipe`. | `inputs ACTIVE`, `touch DOUBLE_TAP`, `touch SWIPE`. |
| 3 | Tap `Speech`, `Mock: say add`. | `speech STARTED`, `transcript "add" final 0.9`. |
| 4 | Tap `Speak line`. | The phone speaks. The frame size is the same before and after. |
| 5 | Tap `Mock: still image`, then `Still`. | One `still` line with the size of the image. |
| 6 | Type `test`, enable `Record motion` for 3 seconds. Pull the file. | Each line has 14 values. |

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/android
git commit -m "feat(android): add Motion, Inputs, Speech, audio, and still capture to the probe"
```

---

### Task 4 [C1]: Probe run on the glasses, results file

**Files:**
- Create: `docs/research/2026-11-14-probe-results.md`
- Create: `apps/mobile/android/core/src/test/resources/motion/` with six recordings
- Modify: `apps/mobile/android/app/src/main/kotlin/com/metaglance/android/dat/ProbeDecisions.kt`

**Interfaces:**
- Consumes: the probe of Tasks 1 to 3.
- Produces: the results file, the recordings, 20 frames for seat 2, and the measured values in `ProbeDecisions`.

This task has no code test. A human does it with the glasses. Stream time: about 25 minutes, in two charges.

- [ ] **Step 1: Prepare**

- Charge the glasses to 100 percent. Pair them in the Meta AI app.
- Check the versions against the 1.0.1 table: run `search_dat_docs` with `version dependencies 1.0.1 Meta AI app`. The research notes give Meta AI app V292 and glasses V128.
- Developer Mode: Meta AI app, Settings, App Info, tap the app version five times, enable the Developer Mode toggle, confirm.
- Remove each other DAT app from the phone. Developer Mode keeps one third-party app registered.
- Install the probe: `./gradlew :app:installDebug`. Keep `adb logcat -s Glance` open on the laptop.
- Items: 6 or more packaged products. A QR code with the text `GL1 K3X7`, shown 15 cm wide on a laptop screen. A chair, a low shelf, a tape measure.

- [ ] **Step 2: Stage A and B, the gate (stream: 5 minutes)**

Write each result in the results file at once.

| # | Do | Expected | Write down |
|---|---|---|---|
| 1 | Tap `Bluetooth permission`. Allow. | `bluetooth granted`, `dat initialized` | |
| 2 | Tap `Register`. Confirm in Meta AI. | The probe returns. `registration REGISTERED`. A `device` line with `link=CONNECTED`. If it stays `AVAILABLE`, Developer Mode is off. | Battery level |
| 3 | Tap `Camera permission`. Select "Allow always". | `camera permission GRANTED` | |
| 4 | Tap `Mic permission`. Allow. | `microphone permission GRANTED` | |
| 5 | Wear the glasses. Tap `Start session`. | Within 10 seconds: `session STARTED`, `stream STREAMING`, `frame 720x1280`. The capture LED is on. | Frame size, frame rate, a size line if the buffer is not `width x height x 3 / 2` |
| 6 | Tap `Motion`. | `motion STARTED` and a rising sample count | Pass or the error name |
| 7 | Tap `Inputs`. Double tap the touchpad. Swipe forward and back. | `inputs ACTIVE`, `touch DOUBLE_TAP`, `touch SWIPE`. If it is `ACTIVE` with no event: use `CAPTOUCH`, `CAPTURE_BUTTON`, `ACTION_BUTTON` as sources, build, repeat. | Pass or the error name, the sources |
| 8 | Tap `Speech`. Say "add". | `speech STARTED locale=<...>`, `transcript "add" final` | Pass or the error name, the locale |
| 9 | Tap `Speak line`. | The line plays in the glasses, not in the phone. An output of type `BLUETOOTH_A2DP` is in the list. The frame size holds. | Where it played, both frame sizes, each transcript during the line |
| 10 | Tap `Axis test` and nod three times. Tap it again and shake the head three times. | Two `axis` lines | Pitch axis and `firstSign` of the nod run. Yaw axis of the shake run. |
| 11 | Tap `Still`. Read the next 5 seconds of the log. | One `still` line. `revive` lines if a capability stopped, then `STARTED` or `ACTIVE` again. | Size, variant, milliseconds, what stopped, what came back |

If row 6, 7, or 8 fails with a permission or capability error, row 1 of the results fails. Go to row 26, first switch, then repeat rows 5 to 8.

- [ ] **Step 3: Stage C, gestures of the device (stream: 3 minutes)**

| # | Do | Write down |
|---|---|---|
| 12 | Tap the touchpad one time. Tap it again. | The `session` and `stream` lines of the pause and of the resume |
| 13 | Remove the glasses from the face. Wear them again. | The `don` lines, each `session` or `stream` change, and if a tap was necessary |
| 14 | Tap and hold the touchpad. Then tap `Start session`. | The session error name. The new session reaches `STREAMING`. |
| 15 | Fold the glasses. Unfold them. Start a session. | The `hinge`, `link`, session error, and stream error lines. Seconds until `link=CONNECTED`. |
| 16 | Remove the glasses. Tap `Start session`. Wear them. | The stream state when worn. The iOS notes say: paused until a tap. |

- [ ] **Step 4: Stage D, frames and the kiosk code (stream: 5 minutes)**

| # | Do | Write down |
|---|---|---|
| 17 | Hold a product in front of the face, front to the camera, at reading distance. Type its label. Tap `Save frame`. Take 2 or 3 frames for each product, 20 in total. Keep people out of the view. | The label of each product |
| 18 | Sit on the chair, 1.0 m from the QR code. Enable `QR log`. Repeat at 1.5 m and 2.0 m. | Decode or no decode, and the `area`, for each distance |

- [ ] **Step 5: Stage E, motion recordings (Motion: 6 minutes)**

| # | Do | Write down |
|---|---|---|
| 19 | Tap `Stop session`, `Start session (no camera)`, `Motion`. | `motion STARTED` with no stream, or the error. If it fails, use `Start session` for row 20. |
| 20 | Record six files with these labels. `nods__nod5_shake0`: 5 nods, 2 seconds apart. `shakes__nod0_shake5`: 5 shakes. `walk__nod0_shake0`: 60 seconds of walk with looks at shelves. `putback__nod0_shake0`: 5 put-backs on the low shelf. `talk__nod0_shake0`: 30 seconds of speech with natural head movement. `look__nod0_shake0`: 5 looks to each side and 3 looks up at a high shelf. | |

Charge the glasses to 100 percent.

- [ ] **Step 6: Stage F, endurance (stream: 10 minutes)**

| # | Do | Write down |
|---|---|---|
| 21 | Tap `Start session`, `Motion`, `Endurance 10 min`. Wear the glasses, walk, look at products. | Battery at start and at end, the highest thermal level, each frame size change, each stop |

- [ ] **Step 7: Collect the files and write the results**

| # | Do |
|---|---|
| 22 | In PowerShell at the repository root: `adb pull /sdcard/Android/data/com.metaglance.android/files/probe probe-out`. Do not commit `probe-out`. |
| 23 | Look at each of the 20 frames: no person is in view. Give the frames to seat 2 for `apps/server/testdata/frames/<label>/` (Plan 1 Task 21). Plan 1 keeps test frames out of the repository. |
| 24 | Copy the six CSV files to `apps/mobile/android/core/src/test/resources/motion/`. |
| 25 | Write `docs/research/2026-11-14-probe-results.md` from the template below. |
| 26 | Apply the switches below, and put the measured values in `ProbeDecisions.kt`. |
| 27 | Commit. |

Template of the results file:

```markdown
# Probe results

Date and time, phone model, Android version, Meta AI app version, glasses firmware, DAT 1.0.1, app ID.

## Results for spec section 16

| Probe | Result | Evidence | Decision |
|---|---|---|---|
| Motion, Inputs, and Speech start with app ID `0` | | | |
| Motion starts (with or without a project) | | | |
| Inputs starts | | | |
| Speech starts | | | |
| A clip plays during the stream, and the frame size holds | | | |
| Stream, Motion, and audio for 10 minutes | | | |
| Gemini names 18 of the 20 saved frames | open, seat 2 | 20 frames given to seat 2 | |
| The kiosk code decodes from a chair at 1.5 m | | | |

## Values for seat 4

`motion`: true or false. `inputs`: true or false. `speech`: `glasses`, `phone`, or `none`. `access`: `developerMode` or `releaseChannel`.
`kiosk-distance`: the largest distance in m with a decode. `battery`: percent used in the 10 minutes of row 21.

## Values for later tasks

| Value | Result | Used by |
|---|---|---|
| Frame size, frame rate, buffer size check | | Tasks 7, 14 |
| Pitch axis, sign of down, yaw axis | | Task 8 |
| Output device during a line, transcripts during a line | | Tasks 14, 23 |
| Still: size, variant, milliseconds, what stopped, what came back | | Task 25 |
| Single tap: states of pause and resume | | Task 17 |
| Doff and don: states, tap necessary or not | | Tasks 15, 17 |
| Tap and hold: session error name | | Task 11 |
| Fold and unfold: error names, seconds until the link returns | | Tasks 11, 17 |
| Start off the face: stream state when worn | | Task 15 |
| Motion with no camera stream | | Task 8 |
| QR decode and area at 1.0 m, 1.5 m, 2.0 m | | Task 6 |
| Speech locale | | Task 23 |
```

Switches:

| Result | Change |
|---|---|
| Row 6, 7, or 8 fails with app ID `0` | Create a project in the Wearables Developer Center, enable the capabilities, create a version, and invite the team to its release channel. Put its values in `local.properties` as `mwdat_application_id` and `mwdat_client_token`. This needs a Meta developer account. Set `access` to `releaseChannel`. |
| Motion fails with a project too | `MOTION = false`. If Inputs passes, Task 22 is core. If Inputs fails, Task 21 is core. Tell seats 2, 3, and 4 that the pitch line is "glance tells, tap buys". |
| Inputs fails | `INPUTS = false`. Cut Task 22. |
| Speech fails | `SPEECH = false`. Cut Task 23. Set `speech` to `none`. |
| The line plays in the phone, or the frame size drops during it | Task 14 sets the preferred output of the player to the phone speaker. Tell the team. |
| The kiosk code does not decode at 1.5 m | Tell seat 3: the kiosk needs a larger code or a larger screen. |
| The battery number of row 21 | Tell seat 4 for the shoot plan. |
| Row 10 | `PITCH_AXIS` and `YAW_AXIS`. `PITCH_DOWN_SIGN` is the `firstSign` of the nod run, because a nod starts down. |
| Row 19 | `MOTION_NEEDS_STREAM` |
| Row 7 with wider sources | `INPUT_SOURCES` |

```bash
git add docs/research/2026-11-14-probe-results.md apps/mobile/android
git commit -m "docs(research): add the probe results, the motion recordings, and the probe decisions"
```

Open a pull request for `feat/android-c1`. Start `feat/android-c2` from it.

---

### Task 5 [C2]: Contract mirror and frame codec

**Files:**
- Create: `core/src/main/kotlin/com/metaglance/core/contract/Languages.kt`, `Profile.kt`, `Catalog.kt`, `Cart.kt`, `Events.kt`, `Snapshot.kt`, `Device.kt`, `Bridge.kt`, `Rest.kt`, `Codec.kt`
- Create: `core/src/main/kotlin/com/metaglance/core/frame/FrameCodec.kt`
- Test: `core/src/test/kotlin/com/metaglance/core/contract/FixturesTest.kt`, `CodecTest.kt`, `core/src/test/kotlin/com/metaglance/core/frame/FrameCodecTest.kt`

**Interfaces:**
- Consumes: the types and the fixtures of Plan 0 Tasks 1 to 5.
- Produces: one Kotlin type for each type of Plan 0, by the rules below, and:

```kotlin
// contract/Codec.kt
val GlanceJson: Json        // classDiscriminator = "t", ignoreUnknownKeys = true. No other setting.
object Codec {
    fun encode(message: DeviceToServer): String
    fun encode(message: NativeToPage): String
    fun decodeServerToDevice(text: String): ServerToDevice?     // null for an unknown t and for bad JSON
    fun decodePageToNative(text: String): PageToNative?
    fun decodeServerEvent(event: JsonObject): ServerEvent?
}
object Profiles {
    val DEFAULT: Profile
    fun applyPatch(profile: Profile, patch: JsonObject): Profile   // a patch that does not decode changes nothing
}

// The names that other tasks use
sealed interface DeviceToServer {
    data class Intent(val kind: IntentKind, val source: IntentSource, val promptId: String? = null)
    data class PromptDone(val promptId: String)                    // "prompt.done"
    data class KioskSeen(val text: String)
    data class SpeechFinal(val text: String, val confidence: Double, val locale: String)
    data class DeviceStateChanged(val state: DeviceState)          // "device.state"
    data class CartEdit(val productId: String, val qty: Int)
    data class ProfileSet(val patch: JsonObject)
    data class BiometricResult(val ok: Boolean)
}
sealed interface ServerToDevice {
    data class Speak(val id: String, val priority: Priority, val text: String, val lang: Lang, val url: String?,
        val sound: SoundName?, val interrupt: Boolean, val promptId: String?)
    data class Event(val event: JsonObject)
    data class Snapshot(val session: JsonObject)
    data object SessionRest; data object SessionEnd; data object BiometricRequest
}
sealed interface PageToNative {
    data object UiReady; data object SetupRegister; data object SetupRequestCamera; data object SetupOpenUpdate
    data object SessionStart; data object SessionEnd; data object DataDelete
    data class Intent(val kind: IntentKind, val promptId: String? = null)
    data class CartEdit(val productId: String, val qty: Int)
    data class ProfileSet(val patch: JsonObject)
    data class PocketSet(val on: Boolean)
    data class Haptic(val pattern: HapticPattern)
}
sealed interface NativeToPage {
    data class NativeStateChanged(val state: NativeState)          // "native.state"
    data class ProfileChanged(val profile: Profile)                // "profile"
    data class Event(val event: JsonObject)
    data class Snapshot(val session: JsonObject)
}

// frame/FrameCodec.kt
@Serializable data class FrameHeader(val seq: Int, val ts: Long, val w: Int, val h: Int, val blurred: Boolean, val kind: FrameKind? = null)
enum class FrameKind { FRAME, STILL }          // wire values "frame", "still"
class FrameFormatError(message: String) : Exception(message)
const val MAX_FRAME_HEADER_BYTES = 1024
object FrameCodec {
    fun encode(header: FrameHeader, jpeg: ByteArray): ByteArray
    fun decode(message: ByteArray): Pair<FrameHeader, ByteArray>
}
```

Mirror rules:

1. One Kotlin file for each TypeScript file of Plan 0. The same type names, the same field names, the same field order.
2. A string union is an `enum class`. Each constant has `@SerialName` with the wire value. The constant name is the wire value in upper snake case: `inCart` gives `IN_CART`.
3. Unions with no TypeScript name get these names: `Detail`, `YesGesture`, `MainYes`, `PendingKind` (`new`, `inCart`), `CartChangeKind`, `Diet`, `Link`, `StreamStatus`, `Registration`, `CameraPermission`, `SessionStatus`, `Network`, `KioskState`.
4. An inline object type gets the name of its field: `NativeDevice`, `Capabilities`, `CartChange`.
5. A discriminated union is a `sealed interface` with `@JsonClassDiscriminator`: `t` for the four message unions, `type` for `ServerEvent`, `kind` for `Warning` and `CurrentPrompt`. Each variant is `@Serializable` with `@SerialName` of its wire value. Its class name is the wire value in Pascal case with no dot: `glance.pending` gives `GlancePending`. `KioskEvent` is one data class with a `type: String` field.
6. An optional field (`?:`) is nullable with the default `null`, so the encoder leaves it out. A nullable field (`| null`) is nullable with no default, so the encoder writes `null`. No other field has a default value. One exception: `Product.lookAlikes` defaults to an empty list.
7. Cents, counts, and sizes are `Int`. `ts` and durations are `Long`. `speechRate` and `confidence` are `Double`. `paidAt` is a `String`.
8. `ProfilePatch` is a `JsonObject`. A typed class cannot tell "absent" from "set to null" for `headWindowMs` and `budgetCents`.
9. `checkout.paid` and `caption` carry the fields of `Receipt` and `Caption` directly.
10. `Codec` catches `SerializationException` and `IllegalArgumentException` and returns `null`.

- [ ] **Step 1: Write the failing tests**

`FrameCodecTest.kt` has the vectors of `frame.test.ts` of Plan 0:

```kotlin
private val jpeg = byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0x01, 0x02, 0xFF.toByte(), 0xD9.toByte())
private val header = FrameHeader(seq = 7, ts = 1794600000000, w = 576, h = 768, blurred = true)
private fun hex(bytes: ByteArray) = bytes.joinToString("") { "%02x".format(it) }

@Test fun `writes the same bytes as encodeFrame of Plan 0`() {
    assertEquals("0000003b7b22736571223a372c227473223a313739343630303030303030302c2277223a3537362c2268223a3736382c22626c7572726564223a747275657dffd80102ffd9",
        hex(FrameCodec.encode(header, jpeg)))
}
@Test fun `round-trips a frame`() {
    val (h, body) = FrameCodec.decode(FrameCodec.encode(header, jpeg))
    assertEquals(header, h); assertArrayEquals(jpeg, body)
}
@Test fun `writes kind for a still only`() {
    assertFalse(String(FrameCodec.encode(header, jpeg), Charsets.ISO_8859_1).contains("kind"))
    assertTrue(String(FrameCodec.encode(header.copy(kind = FrameKind.STILL), jpeg), Charsets.ISO_8859_1).contains("\"kind\":\"still\""))
}
@Test fun `rejects a message shorter than 4 bytes`() {
    assertThrows(FrameFormatError::class.java) { FrameCodec.decode(byteArrayOf(0, 0)) }
}
@Test fun `rejects a header length larger than the message or larger than the limit`() {
    assertThrows(FrameFormatError::class.java) { FrameCodec.decode(byteArrayOf(0, 0, 0, 200.toByte(), 0x7b, 0x7d)) }
    val overLimit = ByteArray(4 + 2000).also { it[2] = 0x07; it[3] = 0xD0.toByte() }   // length 2000
    assertThrows(FrameFormatError::class.java) { FrameCodec.decode(overLimit) }
}
@Test fun `rejects a header that is not JSON and a body that is not a JPEG`() {
    assertThrows(FrameFormatError::class.java) { FrameCodec.decode(byteArrayOf(0, 0, 0, 2, 0x7b, 0x7b, 0xFF.toByte(), 0xD8.toByte())) }
    assertThrows(FrameFormatError::class.java) { FrameCodec.decode(FrameCodec.encode(header, byteArrayOf(0x89.toByte(), 0x50))) }
}
```

`CodecTest.kt`:

```kotlin
@Test fun `leaves out an optional field and writes a nullable field as null`() {
    assertEquals("""{"t":"intent","kind":"yes","source":"head"}""",
        Codec.encode(DeviceToServer.Intent(IntentKind.YES, IntentSource.HEAD)))
    val state = DeviceState(Link.DISCONNECTED, null, null, null, null, StreamStatus.STOPPED)
    assertEquals("""{"t":"device.state","state":{"link":"disconnected","battery":null,"worn":null,"hingeOpen":null,"thermal":null,"stream":"stopped"}}""",
        Codec.encode(DeviceToServer.DeviceStateChanged(state)))
}
@Test fun `returns null for an unknown message and for text that is not JSON`() {
    assertNull(Codec.decodeServerToDevice("""{"t":"launch.rocket"}"""))
    assertNull(Codec.decodeServerToDevice("x"))
    assertNull(Codec.decodePageToNative("""{"t":"intent","kind":"maybe"}"""))
    assertNull(Codec.decodeServerEvent(JsonObject(mapOf("type" to JsonPrimitive("glance.exploded")))))
}
@Test fun `decodes a line with no clip`() {
    val speak = Codec.decodeServerToDevice("""{"t":"speak","id":"s-1","priority":"normal","text":"Skipped.","lang":"en","url":null,"sound":null,"interrupt":false,"promptId":null}""")
    assertEquals(ServerToDevice.Speak("s-1", Priority.NORMAL, "Skipped.", Lang.EN, null, null, false, null), speak)
}
@Test fun `has the default profile of Plan 0`() {
    assertEquals(Profile(Lang.EN, Detail.STANDARD, 1.0, true, true, YesGesture.NOD, 8000, true, MainYes.HEAD,
        emptyList(), false, false, null), Profiles.DEFAULT)
}
@Test fun `applies a profile patch and keeps null as a value`() {
    val patch = buildJsonObject { put("headWindowMs", JsonNull); put("speechRate", 1.5); put("foo", 1) }
    val p = Profiles.applyPatch(Profiles.DEFAULT, patch)
    assertNull(p.headWindowMs); assertEquals(1.5, p.speechRate, 0.0)
    assertEquals(Profiles.DEFAULT, Profiles.applyPatch(Profiles.DEFAULT, buildJsonObject { put("speechRate", "fast") }))
}
```

`FixturesTest.kt` reads the folder of the system property `glance.fixtures`:

```kotlin
@Test fun `knows each fixture folder`() {
    assertEquals(setOf("catalog", "events", "device-to-server", "server-to-device", "bridge-page-to-native",
        "bridge-native-to-page", "rest"), root.list()!!.toSet())
}
@Test fun `has the fixture counts of Plan 0`() {
    assertEquals(mapOf("catalog" to 1, "events" to 16, "device-to-server" to 8, "server-to-device" to 6,
        "bridge-page-to-native" to 12, "bridge-native-to-page" to 4, "rest" to 7), counts())
}
@Test fun `decodes each message fixture, and the file name is the wire value`() { /* five folders. Assert not null, and name == t or type. */ }
@Test fun `decodes the catalog fixture and each rest fixture by the type in its file name`() { /* Product, and the 7 REST types */ }
@Test fun `encodes each message that the app sends back to the same JSON`() {
    /* folders device-to-server and bridge-native-to-page: encode(decode(text)) equals the file, compared as JSON trees with numbers as doubles */
}
```

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `./gradlew :core:test --tests "*contract*" --tests "*FrameCodecTest"`
Expected: FAIL at compile time. If the fixtures folder is missing, `FixturesTest` fails with `fixtures not found`: do Tasks 6 to 8 first.

- [ ] **Step 3: Implement the contract files, `Codec`, `Profiles`, and `FrameCodec`**

`FrameCodec.decode` checks each length before it reads. `@JsonClassDiscriminator` needs `@OptIn(ExperimentalSerializationApi::class)`.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `./gradlew :core:test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/android/core
git commit -m "feat(android): add the Kotlin mirror of the shared contract and the frame codec"
```

---

### Task 6 [C2]: Kiosk code parser and dwell

**Files:**
- Create: `core/src/main/kotlin/com/metaglance/core/kiosk/KioskCode.kt`, `KioskDwell.kt`
- Test: `core/src/test/kotlin/com/metaglance/core/kiosk/KioskCodeTest.kt`, `KioskDwellTest.kt`

**Interfaces:**
- Consumes: `Timing` (Task 1).
- Produces:

```kotlin
object KioskCode {
    fun parse(text: String): String?       // "  gl1   k3x7 \n" -> "K3X7". The rules of parseKioskCode of Plan 0.
    fun format(code: String): String       // "K3X7" -> "GL1 K3X7"
}
data class SeenCode(val code: String, val areaPx: Int)
class KioskDwell(private val dwellMs: Long = Timing.kioskDwellMs, private val repeatMs: Long = 1000,
                 private val gapMs: Long = 600, private val switchRatio: Double = 1.2) {
    fun onFrame(nowMs: Long, codes: List<SeenCode>): String?    // the code to report now, or null
}
```

Rules for `KioskDwell`:

1. The candidate is the code that the dwell follows. With no candidate, the code with the largest area of the frame becomes the candidate, and its dwell starts at this frame.
2. A candidate that was out of view for more than `gapMs` is dropped. A shorter gap keeps its dwell, because the scanner can miss a frame.
3. Another code replaces the candidate only when its area is more than `switchRatio` times the last area of the candidate. The dwell of the new candidate starts at this frame.
4. Report the candidate when `nowMs - dwellStart >= dwellMs` and it is in the frame. Then report it again each `repeatMs` while it is in the frame.

- [ ] **Step 1: Write the failing tests**

```kotlin
// KioskCodeTest
@Test fun `parses the texts of the Plan 0 test`() {
    assertEquals("K3X7", KioskCode.parse("GL1 K3X7"))
    assertEquals("K3X7", KioskCode.parse("  gl1   k3x7 \n"))
    for (bad in listOf("https://example.com/k/1", "GL2 K3X7", "GL1 TOOLONGCODE", "")) assertNull(KioskCode.parse(bad))
    assertEquals("GL1 K3X7", KioskCode.format("K3X7"))
}

// KioskDwellTest
private val k = listOf(SeenCode("K3X7", 9000))
private fun KioskDwell.feed(range: IntProgression, codes: List<SeenCode>) = range.map { onFrame(it.toLong(), codes) }

@Test fun `reports a code after 1500 ms in view and not before`() {
    val d = KioskDwell()
    assertTrue(d.feed(0..1400 step 100, k).all { it == null })
    assertEquals("K3X7", d.onFrame(1500, k))
}
@Test fun `reports at most one time each second`() {
    val d = KioskDwell(); d.feed(0..1500 step 100, k)
    assertTrue(d.feed(1600..2400 step 100, k).all { it == null })
    assertEquals("K3X7", d.onFrame(2500, k))
}
@Test fun `keeps the dwell over a gap of 600 ms`() {
    val d = KioskDwell(); d.feed(0..500 step 100, k); d.feed(600..1000 step 100, emptyList())
    d.feed(1100..1400 step 100, k)
    assertEquals("K3X7", d.onFrame(1500, k))
}
@Test fun `starts again after a longer gap`() {
    val d = KioskDwell(); d.feed(0..500 step 100, k); d.feed(600..1100 step 100, emptyList())
    assertTrue(d.feed(1200..2600 step 100, k).all { it == null })
    assertEquals("K3X7", d.onFrame(2700, k))
}
@Test fun `reports the largest of two codes`() {
    val both = listOf(SeenCode("K3X7", 9000), SeenCode("ABCD", 40000))
    val d = KioskDwell(); d.feed(0..1400 step 100, both)
    assertEquals("ABCD", d.onFrame(1500, both))
}
@Test fun `starts a new dwell when a larger code takes over`() {
    val both = listOf(SeenCode("K3X7", 9000), SeenCode("ABCD", 40000))
    val d = KioskDwell(); d.feed(0..1000 step 100, k)
    assertTrue(d.feed(1100..2500 step 100, both).all { it == null })
    assertEquals("ABCD", d.onFrame(2600, both))
}
@Test fun `does not swap between two codes of similar size`() {
    val d = KioskDwell()
    val out = (0..1500 step 100).map { t ->
        val flip = (t / 100) % 2 == 0
        d.onFrame(t.toLong(), listOf(SeenCode("ABCD", if (flip) 9500 else 8500), SeenCode("K3X7", 9000)))
    }
    assertEquals("ABCD", out.last())
}
```

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `./gradlew :core:test --tests "*kiosk*"`
Expected: FAIL at compile time.

- [ ] **Step 3: Implement `KioskCode` and `KioskDwell`**

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `./gradlew :core:test --tests "*kiosk*"`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/android/core
git commit -m "feat(android): add the kiosk code parser and the dwell rule"
```

---

### Task 7 [C2]: Frame selection and image math

**Files:**
- Create: `core/src/main/kotlin/com/metaglance/core/image/Sharpness.kt`, `SharpestFramePicker.kt`, `UploadGate.kt`, `FrameGeometry.kt`, `FramePrep.kt`
- Modify: `core/src/main/kotlin/com/metaglance/core/image/I420.kt`
- Test: `core/src/test/kotlin/com/metaglance/core/image/SelectionTest.kt`, `GeometryTest.kt`, `FramePrepTest.kt`

**Interfaces:**
- Consumes: `RawFrame`, `I420` (Task 2). `Timing` (Task 1).
- Produces:

```kotlin
object Sharpness { fun of(luma: ByteArray, width: Int, height: Int): Double }
class SharpestFramePicker<T>(private val everyMs: Long = Timing.uploadEveryMs) {
    fun offer(nowMs: Long, frame: T, sharpness: Double): T?
}
enum class UploadSkip { SOCKET_DOWN, STILL_SENDING, NOT_WORN }
object UploadGate { fun check(socketOpen: Boolean, queuedBytes: Long, worn: Boolean?): UploadSkip? }
data class RectPx(val left: Int, val top: Int, val width: Int, val height: Int)
object FrameGeometry {
    fun full(width: Int, height: Int): RectPx
    fun centerCrop(width: Int, height: Int): RectPx
    fun outputSize(crop: RectPx, maxLongSide: Int = 768): Pair<Int, Int>
}
// added to I420
fun cropScaleToArgb(i420: ByteArray, width: Int, height: Int, crop: RectPx, outWidth: Int, outHeight: Int): IntArray
sealed interface FaceResult {
    data object NotRun : FaceResult
    data object Failed : FaceResult
    data class Found(val boxes: List<RectPx>) : FaceResult     // in frame pixels
}
class PreparedFrame(val argb: IntArray, val width: Int, val height: Int, val blurred: Boolean)
object FramePrep { fun prepare(frame: RawFrame, faces: FaceResult, crop: Boolean): PreparedFrame? }
```

Rules:

1. `Sharpness.of` is the mean of the squared 4-neighbor Laplacian over each 4th pixel in both directions. It reads only the first `width * height` bytes.
2. `SharpestFramePicker.offer`: when `everyMs` passed since the window started, return the sharpest frame that was offered before this call. The new window starts with the frame of this call. If not, keep the frame and return `null`. The first call starts the first window.
3. `UploadGate.check` tests in this order: socket down, `queuedBytes > 0`, `worn == false`. `worn == null` passes.
4. `centerCrop`: 80 percent of the width and 70 percent of the height, in the center. Clear the lowest bit of each of the four values.
5. `outputSize`: if the long side is more than `maxLongSide`, scale both sides so that the long side is `maxLongSide`, and round each side to the nearest even number. If not, return the crop size.
6. `cropScaleToArgb` uses BT.709 limited range and the nearest sample. Alpha is `0xFF`.
7. `FramePrep.prepare`: `Failed` gives `null`. The crop is `centerCrop` if `crop` is true, else `full`. `blurred` is true for `Found` and false for `NotRun`. Task 18 adds the pixelation for `Found`.

- [ ] **Step 1: Write the failing tests**

```kotlin
// SelectionTest
private fun checker(size: Int, square: Int) = ByteArray(size * size) { i -> (if (((i % size) / square + (i / size) / square) % 2 == 0) 16 else 235).toByte() }

@Test fun `a flat image has sharpness 0, and a blurred pattern is less sharp than the pattern`() {
    assertEquals(0.0, Sharpness.of(ByteArray(100 * 100) { 128.toByte() }, 100, 100), 0.0)
    val sharp = checker(96, 8)
    assertTrue(Sharpness.of(sharp, 96, 96) > Sharpness.of(boxBlur3(sharp, 96), 96, 96))   // boxBlur3: a 3 x 3 mean, in the test
    Sharpness.of(ByteArray(6), 2, 2)                                                       // a tiny frame with chroma bytes does not throw
}
@Test fun `picks the sharpest frame of each 500 ms window`() {
    val p = SharpestFramePicker<String>()
    assertNull(p.offer(0, "a", 3.0)); assertNull(p.offer(143, "b", 9.0)); assertNull(p.offer(286, "c", 5.0)); assertNull(p.offer(429, "d", 1.0))
    assertEquals("b", p.offer(572, "e", 2.0))
    assertNull(p.offer(715, "f", 1.0))
    assertEquals("e", p.offer(1072, "g", 0.5))
}
@Test fun `skips an upload for each reason of the spec`() {
    assertEquals(UploadSkip.SOCKET_DOWN, UploadGate.check(false, 0, true))
    assertEquals(UploadSkip.STILL_SENDING, UploadGate.check(true, 1, true))
    assertEquals(UploadSkip.NOT_WORN, UploadGate.check(true, 0, false))
    assertNull(UploadGate.check(true, 0, true)); assertNull(UploadGate.check(true, 0, null))
}

// GeometryTest (Review Focus 5: each stream size)
@Test fun `crops the center for each stream size`() {
    assertEquals(RectPx(72, 192, 576, 896), FrameGeometry.centerCrop(720, 1280))
    assertEquals(RectPx(50, 134, 402, 626), FrameGeometry.centerCrop(504, 896))
    assertEquals(RectPx(36, 96, 288, 448), FrameGeometry.centerCrop(360, 640))
}
@Test fun `limits the long side to 768 and never makes a frame larger`() {
    assertEquals(494 to 768, FrameGeometry.outputSize(RectPx(72, 192, 576, 896)))
    assertEquals(402 to 626, FrameGeometry.outputSize(RectPx(50, 134, 402, 626)))
    assertEquals(432 to 768, FrameGeometry.outputSize(FrameGeometry.full(720, 1280)))
}

// FramePrepTest. frame(w, h, y) makes a RawFrame with Y = y and U = V = 128.
@Test fun `converts black, white, and gray`() {
    fun pixel(y: Int) = I420.cropScaleToArgb(frame(8, 8, y).i420, 8, 8, FrameGeometry.full(8, 8), 8, 8)[0]
    assertEquals(0xFF000000.toInt(), pixel(16))
    assertTrue(pixel(235) and 0xFF >= 254)                    // integer math can give 254
    val gray = pixel(128)
    assertEquals(gray shr 16 and 0xFF, gray and 0xFF); assertEquals(0xFF, gray ushr 24)
}
@Test fun `keeps left and right`() {
    val f = frame(8, 4, 16).also { for (row in 0 until 4) for (col in 4 until 8) it.i420[row * 8 + col] = 235.toByte() }
    val out = I420.cropScaleToArgb(f.i420, 8, 4, FrameGeometry.full(8, 4), 8, 4)
    assertEquals(0xFF000000.toInt(), out[0]); assertTrue(out[7] and 0xFF >= 254)
}
@Test fun `drops a frame when face detection failed`() { assertNull(FramePrep.prepare(frame(720, 1280, 128), FaceResult.Failed, crop = false)) }
@Test fun `follows the size of each frame`() {
    fun size(w: Int, h: Int, crop: Boolean) = FramePrep.prepare(frame(w, h, 128), FaceResult.NotRun, crop)!!.let { it.width to it.height }
    assertEquals(432 to 768, size(720, 1280, false)); assertEquals(432 to 768, size(504, 896, false))
    assertEquals(360 to 640, size(360, 640, false)); assertEquals(494 to 768, size(720, 1280, true))
}
@Test fun `marks a frame as blurred only when face detection ran`() {
    assertFalse(FramePrep.prepare(frame(360, 640, 128), FaceResult.NotRun, false)!!.blurred)
    assertTrue(FramePrep.prepare(frame(360, 640, 128), FaceResult.Found(emptyList()), false)!!.blurred)
}
```

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `./gradlew :core:test --tests "*image*"`
Expected: FAIL at compile time.

- [ ] **Step 3: Implement the five units**

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `./gradlew :core:test --tests "*image*"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/android/core
git commit -m "feat(android): add frame selection, the upload gate, and the image math"
```

---

### Task 8 [C2]: Head gesture detector

**Files:**
- Create: `core/src/main/kotlin/com/metaglance/core/gesture/HeadGestureConfig.kt`, `HeadGestureDetector.kt`, `GyroScript.kt`
- Create: `core/src/test/resources/motion/.gitkeep`, if Task 4 did not create the folder
- Test: `core/src/test/kotlin/com/metaglance/core/gesture/HeadGestureDetectorTest.kt`, `MotionReplayTest.kt`
- Modify: `app/src/debug/kotlin/com/metaglance/android/probe/ProbeActivity.kt`

**Interfaces:**
- Consumes: `GyroSample`, `MotionRow`, `MotionCsv` (Task 1). `Axis` (Task 3). The axes of `ProbeDecisions` (Task 3, measured in Task 4), in Step 6 only.
- Produces:

```kotlin
enum class HeadGesture { NOD, SHAKE }
enum class Sensitivity { GENTLE, NORMAL, FIRM }
data class HeadGestureConfig(
    val pitchAxis: Axis, val pitchDownSign: Int, val yawAxis: Axis,
    val minStrokeRad: Float, val minPeakRadS: Float,
    val maxNodRad: Float = 0.6f, val maxNodMs: Long = 1200, val maxShakeMs: Long = 1500,
    val holdMs: Long = 150, val settleRadS: Float = 0.5f, val restRadS: Float = 0.15f,
    val dominance: Float = 2.0f, val refractoryMs: Long = 600, val gapResetMs: Long = 200,
) {
    companion object { fun of(level: Sensitivity, pitchAxis: Axis, pitchDownSign: Int, yawAxis: Axis): HeadGestureConfig }
}
class HeadGestureDetector(private val config: HeadGestureConfig) {
    fun onSample(sample: GyroSample): HeadGesture?
    fun reset()
}
class GyroScript(private val config: HeadGestureConfig) {     // builds 30 Hz samples from t = 0. The mock menu uses it too.
    fun rest(ms: Int): GyroScript
    fun pitch(angleRad: Double, ms: Int): GyroScript            // positive = down
    fun yaw(angleRad: Double, ms: Int): GyroScript
    fun diagonal(angleRad: Double, ms: Int): GyroScript         // the same pulse on both axes
    fun withWalk(): GyroScript
    fun samples(): List<GyroSample>
    fun rows(): List<MotionRow>                                 // the gyroscope values, accel 0, 9.81, 0, orientation 1, 0, 0, 0
    val lastMoveMs: Long                                        // the time of the last sample of the last pulse
}
```

Levels: `GENTLE` has `minStrokeRad` 0.07 and `minPeakRadS` 0.6. `NORMAL` has 0.10 and 0.8. `FIRM` has 0.16 and 1.2.

`GyroScript` rules, with `dt = 1000.0 / 30` ms:

- `rest(ms)` adds `round(ms / dt)` samples of zero.
- `pitch(a, ms)` adds `n = round(ms / dt)` samples. Sample `i` has the rate `(PI * a / (2 * ms / 1000.0)) * sin(PI * (i + 0.5) * dt / ms)` on the pitch axis, times `pitchDownSign`. `yaw` does the same on the yaw axis.
- `withWalk()` adds to each sample at time `t` ms: pitch `0.3 * sin(2 * PI * 2 * t / 1000)` and yaw `0.25 * sin(2 * PI * t / 1000 + 1)`. The first sample of each 500 ms block `k = floor(t / 500)` also gets pitch `+1.0` for an even `k` and `-1.0` for an odd `k`.

The algorithm. The author ran it against each test below before writing this plan.

```text
For each axis keep: angle, anchor, anchorT, extreme, extremeT, dir (0 = no stroke), peak, quietSince.
The pitch rate is the rate on pitchAxis times pitchDownSign, so down is positive.

step(t, w, dt):                                    w in rad/s, dt in seconds
  angle += w * dt
  if dir == 0:
    if |w| < restRadS: anchor = angle; anchorT = t; peak = 0
    else: peak = max(peak, |w|)
    if |angle - anchor| >= minStrokeRad: dir = sign(angle - anchor); extreme = angle; extremeT = t
  else:
    peak = max(peak, |w|)
    d = angle - extreme
    if d == 0 or sign(d) == dir: extreme = angle; extremeT = t
    else if |d| >= minStrokeRad:
      emit Stroke(dir, amp = |extreme - anchor|, peak, startT = anchorT, endT = extremeT, closedBy = REVERSAL)
      anchor = extreme; anchorT = extremeT; dir = -dir; extreme = angle; extremeT = t; peak = |w|
  quietSince = if |w| < settleRadS then (quietSince or t) else none
  if dir != 0 and quietSince is set and t - quietSince >= holdMs:
    emit Stroke(dir, amp = |angle - anchor|, peak, startT = anchorT, endT = t, closedBy = SETTLE)
    anchor = angle; anchorT = t; dir = 0; peak = 0

onSample(sample):
  dt = time since the last sample. For the first sample, and if dt <= 0 or dt > gapResetMs: reset(), and use dt = 1 / 30 s.
  Step both axes. Keep the last 2.5 s of both angles.
  NOD: a pitch stroke B closes by SETTLE, and the stroke A before it ends where B starts, and
    A.dir = +1, B.dir = -1, minStrokeRad <= A.amp <= maxNodRad, A.peak >= minPeakRadS,
    |B.amp - A.amp| <= max(0.06, 0.35 * A.amp),
    B.endT - A.startT <= maxNodMs + holdMs,
    the span of the yaw angle from A.startT to now <= A.amp / dominance.
  SHAKE: a yaw stroke S2 closes by REVERSAL, and the stroke S1 before it ends where S2 starts, and
    S1.dir = -S2.dir, both amp >= minStrokeRad, both peak >= minPeakRadS,
    now - S1.startT <= maxShakeMs,
    the span of the pitch angle from S1.startT to now <= max(S1.amp, S2.amp) / dominance.
  After a gesture, return null for refractoryMs.
```

A nod must return to its start, so a bend to a low shelf is not a nod. A shake needs two reversals.

- [ ] **Step 1: Write the failing tests**

`HeadGestureDetectorTest.kt`:

```kotlin
private val normal = HeadGestureConfig.of(Sensitivity.NORMAL, Axis.X, 1, Axis.Y)
private fun script(config: HeadGestureConfig = normal) = GyroScript(config)
private fun run(s: GyroScript, config: HeadGestureConfig = normal): List<Pair<HeadGesture, Long>> {
    val d = HeadGestureDetector(config)
    return s.samples().mapNotNull { sample -> d.onSample(sample)?.let { it to sample.tNs / 1_000_000 } }
}
private fun gestures(s: GyroScript, config: HeadGestureConfig = normal) = run(s, config).map { it.first }
private fun nod(a: Double, ms: Int, config: HeadGestureConfig = normal) = script(config).rest(500).pitch(a, ms).pitch(-a, ms).rest(1000)
private fun shake() = script().rest(500).yaw(0.175, 200).yaw(-0.35, 200).yaw(0.35, 200).yaw(-0.175, 200).rest(1000)

@Test fun `a nod is one NOD within 400 ms after it ends`() {
    val s = nod(0.26, 250); val out = run(s)
    assertEquals(listOf(HeadGesture.NOD), out.map { it.first })
    assertTrue(out.single().second - s.lastMoveMs <= 400)
}
@Test fun `a shake is one SHAKE`() { assertEquals(listOf(HeadGesture.SHAKE), gestures(shake())) }
@Test fun `a bend to a low shelf that does not return is not a nod`() {
    assertEquals(emptyList<HeadGesture>(), gestures(script().rest(500).pitch(0.7, 600).rest(2000).pitch(-0.7, 600).rest(1000)))
}
@Test fun `a put-back with a pause is not a nod`() {
    assertEquals(emptyList<HeadGesture>(), gestures(script().rest(500).pitch(0.5, 400).rest(1000).pitch(-0.5, 400).rest(1000)))
}
@Test fun `a look up and back is not a nod`() { assertEquals(emptyList<HeadGesture>(), gestures(nod(-0.26, 250))) }
@Test fun `a look to the side and back is not a shake`() {
    assertEquals(emptyList<HeadGesture>(), gestures(script().rest(500).yaw(0.35, 250).yaw(-0.35, 250).rest(1000)))
}
@Test fun `a slow scan of a shelf is not a shake`() {
    assertEquals(emptyList<HeadGesture>(), gestures(script().rest(500).yaw(0.35, 900).yaw(-0.7, 1200).yaw(0.7, 1200).yaw(-0.35, 900).rest(1000)))
}
@Test fun `a diagonal movement is no gesture`() {
    assertEquals(emptyList<HeadGesture>(), gestures(script().rest(500).diagonal(0.26, 250).diagonal(-0.26, 250).rest(1000)))
}
@Test fun `walk noise for 15 minutes gives no gesture`() {
    assertEquals(emptyList<HeadGesture>(), gestures(script().rest(900_000).withWalk()))
    assertEquals(emptyList<HeadGesture>(), gestures(script().rest(60_000).withWalk(), HeadGestureConfig.of(Sensitivity.GENTLE, Axis.X, 1, Axis.Y)))
}
@Test fun `a nod and a shake still count during a walk`() {
    assertEquals(listOf(HeadGesture.NOD), gestures(nod(0.35, 250).withWalk()))
    assertEquals(listOf(HeadGesture.SHAKE), gestures(shake().withWalk()))
}
@Test fun `a double nod is one NOD`() {
    assertEquals(listOf(HeadGesture.NOD), gestures(script().rest(500).pitch(0.26, 220).pitch(-0.26, 220).pitch(0.26, 220).pitch(-0.26, 220).rest(1000)))
}
@Test fun `the three levels differ`() {
    fun at(level: Sensitivity, a: Double, ms: Int) = HeadGestureConfig.of(level, Axis.X, 1, Axis.Y).let { gestures(nod(a, ms, it), it).size }
    assertEquals(1, at(Sensitivity.GENTLE, 0.085, 200)); assertEquals(0, at(Sensitivity.NORMAL, 0.085, 200))
    assertEquals(1, at(Sensitivity.NORMAL, 0.14, 220)); assertEquals(0, at(Sensitivity.FIRM, 0.14, 220))
    assertEquals(1, at(Sensitivity.FIRM, 0.30, 250))
}
@Test fun `a gap in the samples resets the detector`() {
    val d = HeadGestureDetector(normal)
    val out = nod(0.26, 250).samples().filterNot { it.tNs / 1_000_000 in 601..899 }.mapNotNull { d.onSample(it) }
    assertEquals(emptyList<HeadGesture>(), out)
}
@Test fun `the axis map and the sign apply`() {
    val other = HeadGestureConfig.of(Sensitivity.NORMAL, Axis.Z, -1, Axis.X)
    assertEquals(listOf(HeadGesture.NOD), gestures(nod(0.26, 250, other), other))
    assertEquals(emptyList<HeadGesture>(), gestures(nod(0.26, 250), other))
}
```

`MotionReplayTest.kt`:

```kotlin
private const val MIN_RECORDINGS = 0     // Step 6 sets this to 6.
private val config = HeadGestureConfig.of(Sensitivity.NORMAL, Axis.X, 1, Axis.Y)   // Step 6 uses the axes of ProbeDecisions.

@Test fun `a synthetic nod survives the CSV format`() {
    val text = GyroScript(config).rest(500).pitch(0.26, 250).pitch(-0.26, 250).rest(1000).rows().joinToString("\n") { MotionCsv.format(it) }
    val d = HeadGestureDetector(config)
    assertEquals(listOf(HeadGesture.NOD), MotionCsv.gyro(MotionCsv.parse(text)).mapNotNull { d.onSample(it) })
}
@Test fun `each recording gives the counts in its file name`() {
    val files = File(javaClass.getResource("/motion")!!.toURI()).listFiles { f -> f.name.endsWith(".csv") }!!
    assertTrue("recordings: ${files.size}", files.size >= MIN_RECORDINGS)
    for (f in files) {
        val (nods, shakes) = Regex("__nod(\\d+)_shake(\\d+)\\.csv$").find(f.name)!!.destructured
        val d = HeadGestureDetector(config)
        val out = MotionCsv.gyro(MotionCsv.parse(f.readText())).mapNotNull { d.onSample(it) }
        assertEquals(f.name, nods.toInt(), out.count { it == HeadGesture.NOD })
        assertEquals(f.name, shakes.toInt(), out.count { it == HeadGesture.SHAKE })
    }
}
```

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `./gradlew :core:test --tests "*HeadGestureDetectorTest" --tests "*MotionReplayTest"`
Expected: FAIL at compile time.

- [ ] **Step 3: Implement `HeadGestureConfig`, `HeadGestureDetector`, `GyroScript`**

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `./gradlew :core:test --tests "*gesture*"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/android/core
git commit -m "feat(android): add the head gesture detector with synthetic and replay tests"
```

- [ ] **Step 6: After Task 4, replay the recordings and tune**

1. Set `MIN_RECORDINGS` to 6, and build `config` from `ProbeDecisions`. Run the two test classes.
2. If a count is wrong, change only `minStrokeRad` and `minPeakRadS` of `NORMAL`, then `maxNodRad`. Each synthetic test must still pass.
3. If no setting passes each file, prefer no false gesture. A missed nod costs less than a false yes, because the phone button exists.
4. Write the final values in the probe results file. Commit with `test(android): replay the recorded motion files`.

- [ ] **Step 7: Walk test on the glasses, before the freeze (Motion: 20 minutes)**

Add a probe button `Gesture test`: it runs the detector on `DatLink.gyro` with no head window and logs each gesture with a count. Use `Start session (no camera)` if `MOTION_NEEDS_STREAM` is false.

| # | Do | Write down |
|---|---|---|
| 1 | Two people, 7.5 minutes each: walk, talk, look at shelves, do 10 put-backs on a low shelf. No nod, no shake. | The NOD count is `false-yes`. The SHAKE count is `false-no`. The target is 0 and 0. |
| 2 | Five people: 5 nods and 5 shakes each. | Detected nods of 25, detected shakes of 25. |

Write the numbers in the probe results file and give them to seat 4.

---

### Task 9 [C2]: Speech queue

**Files:**
- Create: `core/src/main/kotlin/com/metaglance/core/audio/SpeechQueue.kt`
- Test: `core/src/test/kotlin/com/metaglance/core/audio/SpeechQueueTest.kt`

**Interfaces:**
- Consumes: `ServerToDevice.Speak`, `Priority`, `SoundName`, `Lang` (Task 5). `Timing` (Task 1).
- Produces:

```kotlin
data class PlayableLine(val id: String, val sound: SoundName?, val url: String?, val text: String, val lang: Lang,
                        val rate: Double, val phoneVoice: Boolean)
interface LinePlayer {
    fun play(line: PlayableLine, onEnd: () -> Unit)   // onEnd runs one time: at the end of the audio, or after a failure
    fun stop()                                        // the onEnd of the stopped line must not run
}
class SpeechQueue(private val player: LinePlayer, private val soundOff: () -> Boolean, private val rate: () -> Double,
                  private val nowMs: () -> Long, private val onPromptDone: (String) -> Unit) {
    fun onSpeak(speak: ServerToDevice.Speak)
    fun sayLocal(text: String)          // a line of the app itself. It interrupts, and it uses the phone voice.
    fun clear()                         // stop, and drop each line
    fun isMuted(nowMs: Long): Boolean
}
```

Rules:

1. One line plays at a time.
2. `interrupt = true`: stop the current line, drop each waiting line, play the new line.
3. `interrupt = false`: the line waits. Order: `high`, then `normal`, then `low`. Arrival order inside one priority.
4. When a line with a `promptId` ends, call `onPromptDone` one time. A line that was stopped or dropped never reports.
5. `soundOff()` is true: play nothing, report a prompt at once, start the next line. The app passes "media volume is 0".
6. `url == null`: the line has `phoneVoice = true`. The player speaks `text` with the phone voice.
7. `isMuted` is true while a line plays, and for `Timing.speechMuteAfterClipMs` after its end.

Rule 6 differs from the note of Plan 0, which says "caption only, and `prompt.done` at once". With rule 6 the fake speech mode of Plan 1 and a failure of ElevenLabs are not silent. The team must confirm this.

- [ ] **Step 1: Write the failing test**

The fake player keeps `lines` (each line that it got), `stopCount`, and a `finish()` that runs the pending `onEnd`. `clock` is a `var Long`. `done` collects the prompt IDs.

```kotlin
private fun speak(id: String, priority: Priority = Priority.NORMAL, interrupt: Boolean = false, promptId: String? = null,
                  url: String? = "https://x.test/$id.mp3") =
    ServerToDevice.Speak(id, priority, "text $id", Lang.EN, url, null, interrupt, promptId)
private val played get() = player.lines.map { it.id }

@Test fun `plays one line at a time in arrival order`() {
    q.onSpeak(speak("a")); q.onSpeak(speak("b"))
    assertEquals(listOf("a"), played)
    player.finish(); assertEquals(listOf("a", "b"), played)
}
@Test fun `a line with interrupt stops the current line and drops the waiting lines`() {
    q.onSpeak(speak("a")); q.onSpeak(speak("b")); q.onSpeak(speak("c", interrupt = true))
    assertEquals(1, player.stopCount); assertEquals(listOf("a", "c"), played)
    player.finish(); assertEquals(listOf("a", "c"), played)
}
@Test fun `a higher priority waits in front of a lower priority`() {
    q.onSpeak(speak("a")); q.onSpeak(speak("low", Priority.LOW)); q.onSpeak(speak("high", Priority.HIGH)); q.onSpeak(speak("normal"))
    repeat(3) { player.finish() }
    assertEquals(listOf("a", "high", "normal", "low"), played)
}
@Test fun `reports a prompt one time when its clip ends`() {
    q.onSpeak(speak("p", promptId = "p-0001")); assertEquals(emptyList<String>(), done)
    player.finish(); assertEquals(listOf("p-0001"), done)
}
@Test fun `does not report a prompt that was interrupted or dropped`() {
    q.onSpeak(speak("p", promptId = "p-0001")); q.onSpeak(speak("w", promptId = "p-0002")); q.onSpeak(speak("c", interrupt = true))
    player.finish()
    assertEquals(emptyList<String>(), done)
}
@Test fun `a line with no clip uses the phone voice and reports its prompt at the end`() {
    q.onSpeak(speak("n", promptId = "p-0003", url = null))
    assertTrue(player.lines.single().phoneVoice); assertEquals(emptyList<String>(), done)
    player.finish(); assertEquals(listOf("p-0003"), done)
}
@Test fun `a clip that fails still ends the line and reports the prompt`() {     // Review Focus 1
    q.onSpeak(speak("bad", promptId = "p-0004")); q.onSpeak(speak("next"))
    player.finish()                                                              // the player calls onEnd after a failure too
    assertEquals(listOf("p-0004"), done); assertEquals(listOf("bad", "next"), played)
}
@Test fun `with sound off a prompt is reported at once and nothing plays`() {
    soundOff = true
    q.onSpeak(speak("s", promptId = "p-0005"))
    assertEquals(emptyList<String>(), played); assertEquals(listOf("p-0005"), done)
}
@Test fun `is muted while a line plays and for 500 ms after it`() {
    assertFalse(q.isMuted(0))
    clock = 1000; q.onSpeak(speak("a")); assertTrue(q.isMuted(1000))
    clock = 3000; player.finish()
    assertTrue(q.isMuted(3499)); assertFalse(q.isMuted(3500))
}
@Test fun `a local line interrupts and uses the phone voice`() {
    q.onSpeak(speak("a")); q.sayLocal("Connection lost. Your cart is safe. Glances are paused.")
    assertEquals(1, player.stopCount)
    assertTrue(player.lines.last().phoneVoice)
    assertEquals("Connection lost. Your cart is safe. Glances are paused.", player.lines.last().text)
}
@Test fun `gives each line the speech rate of the profile`() {
    speechRate = 1.5; q.onSpeak(speak("a"))
    assertEquals(1.5, player.lines.single().rate, 0.0)
}
```

- [ ] **Step 2: Run the test and make sure it fails**

Run: `./gradlew :core:test --tests "*SpeechQueueTest"`
Expected: FAIL at compile time.

- [ ] **Step 3: Implement `SpeechQueue`**

- [ ] **Step 4: Run the test and make sure it passes**

Run: `./gradlew :core:test --tests "*SpeechQueueTest"`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/android/core
git commit -m "feat(android): add the speech queue with interrupt, prompt.done, and the mute time"
```

---

### Task 10 [C2]: Prompt tracker and head input

**Files:**
- Create: `core/src/main/kotlin/com/metaglance/core/input/PromptTracker.kt`, `HeadInput.kt`, `MainYesResolver.kt`
- Test: `core/src/test/kotlin/com/metaglance/core/input/PromptTrackerTest.kt`, `HeadInputTest.kt`, `MainYesResolverTest.kt`

**Interfaces:**
- Consumes: `HeadGestureDetector`, `GyroScript` (Task 8). `Profile`, `ServerEvent`, `DeviceToServer.Intent`, `MainYes` (Task 5).
- Produces:

```kotlin
class PromptTracker {
    fun onPromptSpoken(promptId: String)                  // a speak with this promptId arrived
    fun onPromptDone(promptId: String, nowMs: Long)       // prompt.done went out
    fun onEvent(event: ServerEvent)
    fun reset()
    fun lastFinishedPromptId(): String?                   // rule R3: the ID that each yes and each no carries
    fun currentPromptId(): String?                        // finished, and not ended or replaced
    fun headPromptId(nowMs: Long, headWindowMs: Long?): String?   // rule R4. null window = until it ends
}
class HeadInput(private val detector: HeadGestureDetector, private val prompts: PromptTracker) {
    fun onSample(sample: GyroSample, nowMs: Long, profile: Profile): DeviceToServer.Intent?
}
object MainYesResolver { fun resolve(wanted: MainYes, motion: Boolean, inputs: Boolean, speech: Boolean): MainYes }
```

Rules:

1. `onPromptSpoken` makes the prompt the latest one. An earlier prompt is replaced. A prompt that plays again (a repeat) is not finished until its next `onPromptDone`.
2. `onPromptDone` counts only for the latest prompt.
3. `glance.cleared` with the ID of the latest prompt ends it. `checkout.cancelled`, `checkout.paid`, and `checkout.failed` end a latest prompt.
4. `lastFinishedPromptId` stays after the prompt ended. The server decides if the answer counts.
5. `headPromptId` is the current prompt while `nowMs - doneAt < headWindowMs`.
6. `HeadInput`: with `profile.headGestures == false`, return `null`. With no head prompt, call `detector.reset()` and return `null`. A gesture gives `Intent(kind, IntentSource.HEAD, promptId)`. NOD is `yes` when `profile.yesGesture` is `nod`, else `no`. SHAKE is the other one.
7. `MainYesResolver`: `HEAD` needs motion, `TOUCH` needs inputs, `VOICE` needs speech. `PHONE` and `KEY` always work. Fallback: `HEAD` to `TOUCH` to `KEY`. `VOICE` falls back to `HEAD` first.

- [ ] **Step 1: Write the failing tests**

```kotlin
// PromptTrackerTest
private val cleared = { id: String -> ServerEvent.GlanceCleared(id) }

@Test fun `a prompt that still plays opens nothing`() {
    val t = PromptTracker(); t.onPromptSpoken("p-0001")
    assertNull(t.headPromptId(0, 8000)); assertNull(t.currentPromptId()); assertNull(t.lastFinishedPromptId())
}
@Test fun `the head window lasts 8 seconds after the prompt ends`() {
    val t = PromptTracker(); t.onPromptSpoken("p-0001"); t.onPromptDone("p-0001", 1000)
    assertEquals("p-0001", t.headPromptId(1000, 8000)); assertEquals("p-0001", t.headPromptId(8999, 8000))
    assertNull(t.headPromptId(9000, 8000))
    assertEquals("p-0001", t.currentPromptId()); assertEquals("p-0001", t.lastFinishedPromptId())
    assertEquals("p-0001", t.headPromptId(100_000, null)); assertEquals("p-0001", t.headPromptId(15_999, 15_000))
}
@Test fun `a cleared prompt closes the window, and its ID stays the last finished one`() {
    val t = PromptTracker(); t.onPromptSpoken("p-0001"); t.onPromptDone("p-0001", 1000)
    t.onEvent(cleared("p-0009")); assertEquals("p-0001", t.currentPromptId())
    t.onEvent(cleared("p-0001"))
    assertNull(t.headPromptId(2000, 8000)); assertNull(t.currentPromptId()); assertEquals("p-0001", t.lastFinishedPromptId())
}
@Test fun `a new prompt replaces the old one before it ends`() {
    val t = PromptTracker(); t.onPromptSpoken("p-0001"); t.onPromptDone("p-0001", 1000); t.onPromptSpoken("p-0002")
    assertNull(t.headPromptId(2000, 8000)); assertNull(t.currentPromptId()); assertEquals("p-0001", t.lastFinishedPromptId())
    t.onPromptDone("p-0001", 2500); assertNull(t.currentPromptId())          // a late report of the old prompt
    t.onPromptDone("p-0002", 3000); assertEquals("p-0002", t.headPromptId(3000, 8000))
}
@Test fun `a repeat closes the window until the line ends again`() {
    val t = PromptTracker(); t.onPromptSpoken("p-0001"); t.onPromptDone("p-0001", 1000); t.onPromptSpoken("p-0001")
    assertNull(t.headPromptId(2000, 8000))
    t.onPromptDone("p-0001", 12_000); assertEquals("p-0001", t.headPromptId(19_000, 8000))
}
@Test fun `the end of a checkout ends the prompt`() {
    for (event in listOf(ServerEvent.CheckoutCancelled, ServerEvent.CheckoutFailed("declined"))) {
        val t = PromptTracker(); t.onPromptSpoken("p-0001"); t.onPromptDone("p-0001", 0); t.onEvent(event)
        assertNull(t.currentPromptId())
    }
}

// HeadInputTest (Review Focus 2). feed() gives each sample of a script to HeadInput with nowMs = startMs + sample time,
// and returns the intents. With beforeSampleAt, it runs the block before the first sample at or after that time.
private val config = HeadGestureConfig.of(Sensitivity.NORMAL, Axis.X, 1, Axis.Y)
private fun nod() = GyroScript(config).pitch(0.26, 250).pitch(-0.26, 250).rest(600)

@Test fun `a nod inside the head window is a yes with the prompt ID`() {
    prompts.onPromptSpoken("p-0001"); prompts.onPromptDone("p-0001", 0)
    assertEquals(listOf(DeviceToServer.Intent(IntentKind.YES, IntentSource.HEAD, "p-0001")), feed(nod(), startMs = 500, Profiles.DEFAULT))
}
@Test fun `a nod that starts before the prompt ends sends nothing`() {
    prompts.onPromptSpoken("p-0001")
    val out = feed(nod(), startMs = 0, Profiles.DEFAULT, beforeSampleAt = 300) { prompts.onPromptDone("p-0001", 300) }
    assertEquals(emptyList<DeviceToServer.Intent>(), out)
}
@Test fun `a nod after the head window sends nothing`() {
    prompts.onPromptSpoken("p-0001"); prompts.onPromptDone("p-0001", 0)
    assertEquals(emptyList<DeviceToServer.Intent>(), feed(nod(), startMs = 8100, Profiles.DEFAULT))
}
@Test fun `a nod after a new prompt replaced the old one sends nothing`() {
    prompts.onPromptSpoken("p-0001"); prompts.onPromptDone("p-0001", 0); prompts.onPromptSpoken("p-0002")
    assertEquals(emptyList<DeviceToServer.Intent>(), feed(nod(), startMs = 500, Profiles.DEFAULT))
}
@Test fun `a nod is a no when the profile swaps the gestures`() {
    prompts.onPromptSpoken("p-0001"); prompts.onPromptDone("p-0001", 0)
    assertEquals(IntentKind.NO, feed(nod(), 500, Profiles.DEFAULT.copy(yesGesture = YesGesture.SHAKE)).single().kind)
}
@Test fun `sends nothing when head gestures are off`() {
    prompts.onPromptSpoken("p-0001"); prompts.onPromptDone("p-0001", 0)
    assertEquals(emptyList<DeviceToServer.Intent>(), feed(nod(), 500, Profiles.DEFAULT.copy(headGestures = false)))
}

// MainYesResolverTest
@Test fun `keeps an input that works and falls back in the order of spec section 16`() {
    fun r(wanted: MainYes, motion: Boolean, inputs: Boolean, speech: Boolean = false) = MainYesResolver.resolve(wanted, motion, inputs, speech)
    assertEquals(MainYes.HEAD, r(MainYes.HEAD, true, true)); assertEquals(MainYes.TOUCH, r(MainYes.HEAD, false, true))
    assertEquals(MainYes.KEY, r(MainYes.HEAD, false, false)); assertEquals(MainYes.KEY, r(MainYes.TOUCH, true, false))
    assertEquals(MainYes.HEAD, r(MainYes.VOICE, true, true)); assertEquals(MainYes.VOICE, r(MainYes.VOICE, true, true, speech = true))
    assertEquals(MainYes.PHONE, r(MainYes.PHONE, false, false)); assertEquals(MainYes.KEY, r(MainYes.KEY, true, true))
}
```

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `./gradlew :core:test --tests "*input*"`
Expected: FAIL at compile time.

- [ ] **Step 3: Implement the three units**

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `./gradlew :core:test --tests "*input*"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/android/core
git commit -m "feat(android): add the prompt tracker, the head input, and the main yes fallback"
```

---

### Task 11 [C2]: State mapping and stop causes

**Files:**
- Create: `core/src/main/kotlin/com/metaglance/core/state/StateMapper.kt`, `StopCauses.kt`, `NativeErrors.kt`, `ConnectionAnnouncer.kt`
- Test: `core/src/test/kotlin/com/metaglance/core/state/StateMapperTest.kt`, `StopCausesTest.kt`, `NativeErrorsTest.kt`, `ConnectionAnnouncerTest.kt`

**Interfaces:**
- Consumes: `DatSnapshot` and its enums (Task 2). `NativeState`, `NativeDevice`, `Capabilities`, `DeviceState`, `Codec` (Task 5).
- Produces:

```kotlin
object StateMapper {
    fun nativeState(dat: DatSnapshot, phoneOnline: Boolean, socketExpected: Boolean, socketOpen: Boolean): NativeState
    fun deviceState(dat: DatSnapshot): DeviceState
}
enum class StopCause { APP, UPDATE_REQUIRED, TOO_WARM, BATTERY, HINGE_CLOSED, LINK_LOST, DEVICE, OTHER }
data class StopFacts(val requestedByApp: Boolean, val sessionErrors: Set<String>, val streamErrors: Set<String>,
                     val link: DatLinkState?, val hinge: DatHinge?)
object StopCauses {
    fun classify(facts: StopFacts): StopCause             // the first cause that fits, in the order of the enum
    fun autoRestart(cause: StopCause): Boolean            // true for LINK_LOST and HINGE_CLOSED
    fun canStartNow(device: DatDevice?): Boolean          // connected, hinge not CLOSED, not DOFFED
}
data class NativeError(val code: String, val message: String)
object NativeErrors {
    val BLUETOOTH_DENIED: NativeError   // and one constant for each row of the table below
    fun forStop(cause: StopCause): NativeError?           // null for APP
    fun toEvent(error: NativeError): JsonObject           // {"type":"error","code":"...","message":"..."}
}
class ConnectionAnnouncer(private val graceMs: Long = 3000) {
    fun onSocketDown(nowMs: Long); fun onSocketOpen()
    fun onTick(nowMs: Long): String?                      // the line to say now, or null
}
```

Mapping rules. Each state of spec section 6.6 reaches the page through these fields.

| Contract field | From DAT |
|---|---|
| `metaAiInstalled` | `DatSnapshot.metaAiInstalled` |
| `registration` | `UNAVAILABLE`, `AVAILABLE`, `REGISTERING`, `REGISTERED` by name. `UNREGISTERING` gives `registering`. `bluetoothGranted == false` gives `unavailable`. |
| `cameraPermission` | `UNKNOWN`, `GRANTED`, `DENIED` by name |
| `device` | `null` when the snapshot has no device |
| `device.name` | The name, or `null` when it is empty |
| `device.link` | `CONNECTED` gives `connected`. `CONNECTING` and `DISCONNECTED` give `disconnected`. |
| `device.battery` | The level. 0 gives `null`. |
| `device.worn` | `DONNED` true, `DOFFED` false, `UNKNOWN` null |
| `device.hingeOpen` | `OPEN` true, `CLOSED` false, `UNKNOWN` null |
| `device.thermal` | `UNKNOWN` null, `NONE` 0, `LIGHT` 1, `MODERATE` 3, `SEVERE` 5, `CRITICAL` 6, `EMERGENCY` 7, `SHUTDOWN` 7. Plan 1 reads 6 or more as "cannot stream". |
| `device.updateRequired` | `DEVICE_UPDATE_REQUIRED`, or `glassesAppUpdateRequired` |
| `session` | `NONE` idle. `IDLE`, `STARTING` starting. `STARTED` started. `PAUSED` paused. `STOPPING`, `STOPPED` stopped. |
| `stream` | `NONE`, `STOPPING`, `STOPPED`, `CLOSED` stopped. `STARTING`, `STARTED` starting. `STREAMING` streaming. `PAUSED` paused. |
| `network` | `offline` when the phone is offline, or when a server session exists and its socket is not open. Else `online`. |
| `capabilities` | `motionStarted`, `inputsActive`, `speechStarted` |
| `mock` | `DatSnapshot.mock` |

`DeviceState` uses the same rules for `link`, `battery`, `worn`, `hingeOpen`, `thermal`, and `stream`. With no device, `link` is `disconnected` and the four readings are `null`.

`StopCauses.classify`, first match: `requestedByApp` gives APP. Session error `DAT_APP_ON_THE_GLASSES_UPDATE_REQUIRED` gives UPDATE_REQUIRED. `THERMAL_CRITICAL`, `THERMAL_EMERGENCY`, or stream error `THERMAL_HOT` gives TOO_WARM. `BATTERY_CRITICAL`, `PEAK_POWER_SHUTDOWN`, or stream error `BATTERY_LOW` or `PEAK_POWER_LIMIT` gives BATTERY. Stream error `HINGE_CLOSED` or hinge `CLOSED` gives HINGE_CLOSED. `DEVICE_DISCONNECTED` or a link that is not `CONNECTED` gives LINK_LOST. `SESSION_ENDED_BY_DEVICE` gives DEVICE. Else OTHER. The app does not guess a cause.

Error events. `NativeState` has no field for a cause, so the app sends each cause to the page as an `error` event. The page can show `message` as it is.

| Constant | `code` | `message` | Sent when |
|---|---|---|---|
| `BLUETOOTH_DENIED` | `native.bluetooth_denied` | Allow Bluetooth to connect your glasses. | The Android permission is denied |
| `REGISTRATION_FAILED` | `native.registration_failed` | The link to Meta AI failed. Try again. | `FAILED_TO_REGISTER`, `UNKNOWN` |
| `PERMISSION_FAILED` | `native.permission_failed` | The camera request failed. Try again. | A `PermissionError` other than `META_AI_NOT_INSTALLED` |
| `NO_DEVICE` | `native.no_device` | Unfold your glasses and keep them near the phone. | `session.start` with no connected device |
| `NOT_WORN` | `native.not_worn` | Put on your glasses, then start again. | `session.start` while `DOFFED` |
| `SERVER_UNREACHABLE` | `native.server_unreachable` | The server does not answer. Check the connection. | `POST /api/sessions` fails |
| `STOPPED_BY_DEVICE` | `native.stopped_by_device` | The camera stopped on the glasses. Start again when you are ready. | DEVICE |
| `LINK_LOST` | `native.link_lost` | The glasses disconnected. Keep them near the phone. | LINK_LOST |
| `HINGE_CLOSED` | `native.hinge_closed` | Unfold your glasses to continue. | HINGE_CLOSED |
| `TOO_WARM` | `native.too_warm` | The glasses are too warm. Please use a regular checkout. | TOO_WARM |
| `BATTERY_LOW` | `native.battery_low` | The glasses battery is too low. Please use a regular checkout. | BATTERY |
| `UPDATE_REQUIRED` | `native.update_required` | Your glasses need an update. | UPDATE_REQUIRED |
| `SDK_TOO_OLD` | `native.sdk_too_old` | This app version is too old for your glasses. | `SDK_UPDATE_REQUIRED`, `INSUFFICIENT_SDK_VERSION` |
| `SESSION_FAILED` | `native.session_failed` | The camera did not start. Try again. | OTHER, and each other session error |
| `BIOMETRIC_UNAVAILABLE` | `native.biometric_unavailable` | Set a screen lock or a fingerprint on this phone first. | Task 24 |

`ConnectionAnnouncer`: after the socket was down for `graceMs`, `onTick` returns "Connection lost. Your cart is safe. Glances are paused." one time. The server says "Back online." after the reconnect (line `net.backOnline` of Plan 1).

- [ ] **Step 1: Write the failing tests**

```kotlin
// StateMapperTest
private val device = DatDevice("Ray-Ban Meta", DatLinkState.CONNECTED, DatCompatibility.COMPATIBLE, 80, DatDon.DONNED, DatHinge.OPEN, DatThermal.NONE)
private val live = DatSnapshot(bluetoothGranted = true, metaAiInstalled = true, registration = DatRegistration.REGISTERED,
    cameraPermission = DatPermission.GRANTED, microphonePermission = DatPermission.UNKNOWN, device = device,
    session = DatSession.STARTED, stream = DatStream.STREAMING, motionStarted = true, inputsActive = false, speechStarted = false,
    glassesAppUpdateRequired = false, mock = false)
private fun native(dat: DatSnapshot, phoneOnline: Boolean = true, expected: Boolean = true, open: Boolean = true) =
    StateMapper.nativeState(dat, phoneOnline, expected, open)

@Test fun `maps a live session`() {
    val n = native(live)
    assertEquals(NativeState(true, Registration.REGISTERED, CameraPermission.GRANTED,
        NativeDevice("Ray-Ban Meta", Link.CONNECTED, 80, true, true, 0, false),
        SessionStatus.STARTED, StreamStatus.STREAMING, Network.ONLINE, Capabilities(true, false, false), false), n)
    assertEquals(DeviceState(Link.CONNECTED, 80, true, true, 0, StreamStatus.STREAMING), StateMapper.deviceState(live))
}
@Test fun `maps readings that the glasses did not report to null`() {
    val d = native(live.copy(device = device.copy(name = "", battery = 0, don = DatDon.UNKNOWN, hinge = DatHinge.UNKNOWN, thermal = DatThermal.UNKNOWN))).device!!
    assertEquals(NativeDevice(null, Link.CONNECTED, null, null, null, null, false), d)
}
@Test fun `maps the thermal levels so that CRITICAL is 6`() {
    val levels = DatThermal.values().drop(1).map { StateMapper.deviceState(live.copy(device = device.copy(thermal = it))).thermal }
    assertEquals(listOf(0, 1, 3, 5, 6, 7, 7), levels)
}
@Test fun `maps each session state and each stream state`() {
    assertEquals(listOf("idle", "starting", "starting", "started", "paused", "stopped", "stopped"),
        DatSession.values().map { native(live.copy(session = it)).session.name.lowercase() })
    assertEquals(listOf("stopped", "starting", "starting", "streaming", "paused", "stopped", "stopped", "stopped"),
        DatStream.values().map { native(live.copy(stream = it)).stream.name.lowercase() })
}
@Test fun `maps a link that is not ready and a missing device`() {
    assertEquals(Link.DISCONNECTED, native(live.copy(device = device.copy(link = DatLinkState.CONNECTING))).device!!.link)
    assertNull(native(live.copy(device = null)).device)
    assertEquals(DeviceState(Link.DISCONNECTED, null, null, null, null, StreamStatus.STREAMING), StateMapper.deviceState(live.copy(device = null)))
}
@Test fun `maps UNREGISTERING and a denied Bluetooth permission`() {
    assertEquals(Registration.REGISTERING, native(live.copy(registration = DatRegistration.UNREGISTERING)).registration)
    assertEquals(Registration.UNAVAILABLE, native(live.copy(bluetoothGranted = false)).registration)
}
@Test fun `sets updateRequired for the glasses only`() {
    fun update(c: DatCompatibility, app: Boolean = false) = native(live.copy(device = device.copy(compatibility = c), glassesAppUpdateRequired = app)).device!!.updateRequired
    assertTrue(update(DatCompatibility.DEVICE_UPDATE_REQUIRED)); assertTrue(update(DatCompatibility.COMPATIBLE, app = true))
    assertFalse(update(DatCompatibility.SDK_UPDATE_REQUIRED))
}
@Test fun `is offline when the phone is offline or when an expected socket is down`() {
    assertEquals(Network.OFFLINE, native(live, phoneOnline = false).network)
    assertEquals(Network.OFFLINE, native(live, expected = true, open = false).network)
    assertEquals(Network.ONLINE, native(live, expected = false, open = false).network)
}

// StopCausesTest
private fun facts(byApp: Boolean = false, session: Set<String> = emptySet(), stream: Set<String> = emptySet(),
                  link: DatLinkState? = DatLinkState.CONNECTED, hinge: DatHinge? = DatHinge.OPEN) = StopFacts(byApp, session, stream, link, hinge)

@Test fun `names the cause of a stop from errors, link, and hinge`() {
    assertEquals(StopCause.APP, StopCauses.classify(facts(byApp = true, session = setOf("DEVICE_DISCONNECTED"))))
    assertEquals(StopCause.UPDATE_REQUIRED, StopCauses.classify(facts(session = setOf("DAT_APP_ON_THE_GLASSES_UPDATE_REQUIRED"))))
    for (e in listOf("THERMAL_CRITICAL", "THERMAL_EMERGENCY")) assertEquals(StopCause.TOO_WARM, StopCauses.classify(facts(session = setOf(e))))
    assertEquals(StopCause.TOO_WARM, StopCauses.classify(facts(stream = setOf("THERMAL_HOT"))))
    for (e in listOf("BATTERY_CRITICAL", "PEAK_POWER_SHUTDOWN")) assertEquals(StopCause.BATTERY, StopCauses.classify(facts(session = setOf(e))))
    for (e in listOf("BATTERY_LOW", "PEAK_POWER_LIMIT")) assertEquals(StopCause.BATTERY, StopCauses.classify(facts(stream = setOf(e))))
    assertEquals(StopCause.HINGE_CLOSED, StopCauses.classify(facts(stream = setOf("HINGE_CLOSED"))))
    assertEquals(StopCause.HINGE_CLOSED, StopCauses.classify(facts(session = setOf("DEVICE_DISCONNECTED"), link = DatLinkState.DISCONNECTED, hinge = DatHinge.CLOSED)))
    assertEquals(StopCause.LINK_LOST, StopCauses.classify(facts(session = setOf("DEVICE_DISCONNECTED"))))
    assertEquals(StopCause.LINK_LOST, StopCauses.classify(facts(link = DatLinkState.DISCONNECTED)))
    assertEquals(StopCause.DEVICE, StopCauses.classify(facts(session = setOf("SESSION_ENDED_BY_DEVICE"))))
    assertEquals(StopCause.OTHER, StopCauses.classify(facts()))
}
@Test fun `starts a new session by itself only after a lost link or a closed hinge`() {
    assertEquals(setOf(StopCause.LINK_LOST, StopCause.HINGE_CLOSED), StopCause.values().filter { StopCauses.autoRestart(it) }.toSet())
}
@Test fun `waits for glasses that are connected, open, and not off the face`() {
    val d = DatDevice("g", DatLinkState.CONNECTED, DatCompatibility.COMPATIBLE, 80, DatDon.DONNED, DatHinge.OPEN, DatThermal.NONE)
    assertTrue(StopCauses.canStartNow(d)); assertTrue(StopCauses.canStartNow(d.copy(don = DatDon.UNKNOWN)))
    assertFalse(StopCauses.canStartNow(d.copy(don = DatDon.DOFFED))); assertFalse(StopCauses.canStartNow(d.copy(hinge = DatHinge.CLOSED)))
    assertFalse(StopCauses.canStartNow(d.copy(link = DatLinkState.DISCONNECTED))); assertFalse(StopCauses.canStartNow(null))
}

// NativeErrorsTest
@Test fun `has one error for each stop cause except a stop by the app`() {
    assertNull(NativeErrors.forStop(StopCause.APP))
    val codes = StopCause.values().drop(1).map { NativeErrors.forStop(it)!!.code }
    assertEquals(listOf("native.update_required", "native.too_warm", "native.battery_low", "native.hinge_closed",
        "native.link_lost", "native.stopped_by_device", "native.session_failed"), codes)
}
@Test fun `makes an error event of the contract`() {
    val event = Codec.decodeServerEvent(NativeErrors.toEvent(NativeErrors.NO_DEVICE))
    assertEquals(ServerEvent.Error("native.no_device", "Unfold your glasses and keep them near the phone."), event)
}

// ConnectionAnnouncerTest
@Test fun `says the line one time after 3 seconds without the socket`() {
    val a = ConnectionAnnouncer(); a.onSocketDown(1000)
    assertNull(a.onTick(3999))
    assertEquals("Connection lost. Your cart is safe. Glances are paused.", a.onTick(4000))
    assertNull(a.onTick(5000))
}
@Test fun `says nothing for a short drop`() {
    val a = ConnectionAnnouncer(); a.onSocketDown(1000); a.onSocketOpen()
    assertNull(a.onTick(5000))
}
```

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `./gradlew :core:test --tests "*state*"`
Expected: FAIL at compile time.

- [ ] **Step 3: Implement the four units**

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `./gradlew :core:test --tests "*state*"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/android/core
git commit -m "feat(android): map DAT states to the contract and name the cause of each stop"
```

---

### Task 12 [C2]: REST client, device socket, fake server

**Files:**
- Create: `core/src/main/kotlin/com/metaglance/core/net/GlanceApi.kt`, `DeviceSocket.kt`, `Backoff.kt`
- Test: `core/src/test/kotlin/com/metaglance/core/net/GlanceApiTest.kt`, `DeviceSocketTest.kt`
- Create: `apps/mobile/android/tools/fake-server/package.json`, `tools/fake-server/server.mjs`

**Interfaces:**
- Consumes: the contract and `FrameCodec` (Task 5).
- Produces:

```kotlin
class GlanceApi(private val client: OkHttpClient, private val baseUrl: String) {   // each call blocks. IOException on a status that is not 2xx.
    fun createSession(profile: Profile): CreateSessionResponse     // POST /api/sessions, body {"profile":{...}}
    fun snapshot(sessionId: String, token: String): JsonObject     // GET /api/sessions/:id?token=
    fun deleteSession(sessionId: String, token: String)            // DELETE /api/sessions/:id?token=
    fun socketUrl(wsUrl: String): String                           // the path and the query of wsUrl, on baseUrl, with ws or wss
    fun clipUrl(url: String): String                               // the path and the query of url, on baseUrl
}
class Backoff(private val stepsMs: List<Long> = listOf(500, 1000, 2000, 4000, 8000)) { fun delayMs(attempt: Int): Long }
fun interface Scheduler { fun schedule(delayMs: Long, block: () -> Unit): () -> Unit }   // returns a cancel function
class DeviceSocket(private val client: OkHttpClient, private val url: String, private val scheduler: Scheduler,
                   private val listener: Listener, private val backoff: Backoff = Backoff()) {
    interface Listener { fun onOpen(); fun onMessage(message: ServerToDevice); fun onDown() }
    val isOpen: Boolean
    fun queuedBytes(): Long                    // WebSocket.queueSize()
    fun connect(); fun close()
    fun send(message: DeviceToServer): Boolean
    fun sendFrame(header: FrameHeader, jpeg: ByteArray): Boolean
}
```

Rules:

1. `socketUrl` and `clipUrl` keep only the path and the query of the URL that the server sent, and put them on `baseUrl`. The server of Plan 1 builds both from `PUBLIC_BASE_URL`, whose default is `http://localhost:8080`. On a phone, `localhost` is the phone.
2. `DeviceSocket` connects again after each close and each failure that the app did not ask for. The delay is `backoff.delayMs(attempt)`. `onOpen` sets the attempt back to 0.
3. A text message that `Codec.decodeServerToDevice` does not know is dropped with a log line. The socket stays open.
4. `send` and `sendFrame` return `false` while the socket is down. They never queue for a later connection.
5. The app builds the client with `pingInterval(10, TimeUnit.SECONDS)`, so a dead link fails within about 20 seconds.

The fake server, `tools/fake-server/server.mjs`. Node 22, one dependency: `"ws": "^8.23.0"`. It reads its messages from `packages/shared/fixtures`, so it needs Plan 0. Port 8080, or `PORT`.

| Input | Answer |
|---|---|
| `POST /api/sessions` | `{ "sessionId": "s-1", "token": "t-1", "wsUrl": "ws://localhost:8080/ws/device?session=s-1&token=t-1" }`, the form of Plan 1 |
| `GET /api/sessions/s-1` | The `session` object of `fixtures/server-to-device/snapshot.json` |
| `DELETE /api/sessions/s-1` | 204 |
| `GET /clip.wav` | A tone of 1 second, made in memory: 440 Hz, 16-bit mono, 22050 Hz. Each other path gets 404. |
| Socket opens | The `snapshot` fixture |
| A binary message | Log `frame seq=<n> <w>x<h> blurred=<b> kind=<k> <bytes> bytes`. With `SAVE_FRAMES=1`, write the JPEG to `<temp folder>/glance-last.jpg`. |
| `device.state`, `stream` changes to `streaming` | `speak` "Camera on. Hold a product up to hear its price.", `url` `/clip.wav` |
| `device.state`, `stream` changes from `streaming` to `stopped` | `speak` "Camera off.", `url` `null` |
| Frames arrive, no prompt is open, and 15 seconds passed since the last prompt. The first prompt comes 3 seconds after the first frame. | `event` `glance.pending` (fixture) with a new `promptId`, then `speak` "Oat drink, one litre, one eighty-nine. Nod to add." with that `promptId`, `sound` `found`, `url` `/clip.wav` |
| `intent` `yes` with the open `promptId` | `speak` "Added oat drink. Total four forty-nine." with `sound` `added`, `event` `cart.updated` (fixture). For a pay prompt: `event` `checkout.paid` (fixture), `speak` "Paid. Four euros forty-nine. Your receipt is on your phone. Camera off." with `sound` `paid`, then `session.end`. |
| `intent` `no` with the open `promptId` | `event` `glance.cleared`, `speak` "Skipped." |
| `intent` `stop` | `speak` "Camera off.", then `session.end` |
| `kiosk.seen`, no pay prompt open | `event` `checkout.offered` (fixture) with a new `promptId`, `speak` "Checkout 3 at Demo Market. Two items, four euros forty-nine. Nod to pay." with that `promptId` |
| Each other text message | Log it. A `yes` or `no` with another `promptId` logs `rejected`. |
| Keyboard `rest`, `bio`, `amb`, `badclip`, `drop` | `session.rest`. `biometric.request`. `event` `glance.ambiguous` (fixture). A prompt `speak` with `url` `/missing.mp3`. Close the socket and refuse each upgrade for 10 seconds. |

- [ ] **Step 1: Write the failing tests**

Both tests use `MockWebServer`. The socket tests use a fake `Scheduler` that keeps the delays and runs a block on demand. Each `await` helper waits on a queue for 2 seconds at most.

```kotlin
// GlanceApiTest
@Test fun `creates a session with the profile`() {
    server.enqueue(MockResponse().setBody("""{"sessionId":"s-1","token":"t-1","wsUrl":"ws://x.test/ws/device"}"""))
    assertEquals(CreateSessionResponse("s-1", "t-1", "ws://x.test/ws/device"), api.createSession(Profiles.DEFAULT))
    val request = server.takeRequest()
    assertEquals("POST /api/sessions HTTP/1.1", request.requestLine)
    assertTrue(request.body.readUtf8().startsWith("""{"profile":{"lang":"en""""))
}
@Test fun `reads a snapshot and deletes a session with the token`() {
    server.enqueue(MockResponse().setBody("""{"sessionId":"s-1"}""")); server.enqueue(MockResponse().setResponseCode(204))
    assertEquals(JsonPrimitive("s-1"), api.snapshot("s-1", "t-1")["sessionId"])
    assertEquals("/api/sessions/s-1?token=t-1", server.takeRequest().path)
    api.deleteSession("s-1", "t-1")
    assertEquals("DELETE /api/sessions/s-1?token=t-1 HTTP/1.1", server.takeRequest().requestLine)
}
@Test fun `throws on an error status`() {
    server.enqueue(MockResponse().setResponseCode(500))
    assertThrows(IOException::class.java) { api.createSession(Profiles.DEFAULT) }
}
@Test fun `puts the socket URL and each clip URL on the server address of the app`() {
    val lan = GlanceApi(OkHttpClient(), "http://192.168.1.20:8080")
    assertEquals("ws://192.168.1.20:8080/ws/device?session=s-1&token=t-1", lan.socketUrl("ws://localhost:8080/ws/device?session=s-1&token=t-1"))
    assertEquals("http://192.168.1.20:8080/api/speech/abc.mp3", lan.clipUrl("http://localhost:8080/api/speech/abc.mp3"))
    assertEquals("http://192.168.1.20:8080/clip.wav", lan.clipUrl("/clip.wav"))
    val live = GlanceApi(OkHttpClient(), "https://glance.example")
    assertEquals("wss://glance.example/ws/device?session=s-1&token=t-1", live.socketUrl("wss://glance.example/ws/device?session=s-1&token=t-1"))
}

// DeviceSocketTest. `peer` is the server side of the socket. `events` records listener calls.
@Test fun `opens the socket and delivers a speak message`() {
    socket.connect(); awaitOpen()
    peer.send("""{"t":"speak","id":"s-1","priority":"normal","text":"Skipped.","lang":"en","url":null,"sound":null,"interrupt":false,"promptId":null}""")
    assertEquals(ServerToDevice.Speak("s-1", Priority.NORMAL, "Skipped.", Lang.EN, null, null, false, null), awaitMessage())
}
@Test fun `ignores a message of a newer server and stays open`() {
    socket.connect(); awaitOpen()
    peer.send("""{"t":"launch.rocket"}"""); peer.send("""{"t":"session.rest"}""")
    assertEquals(ServerToDevice.SessionRest, awaitMessage()); assertTrue(socket.isOpen)
}
@Test fun `sends a frame as one binary message in the Plan 0 layout`() {
    socket.connect(); awaitOpen()
    val header = FrameHeader(1, 1794600000000, 432, 768, false); val jpeg = byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 1)
    assertTrue(socket.sendFrame(header, jpeg))
    assertArrayEquals(FrameCodec.encode(header, jpeg), awaitBinaryOnServer())
}
@Test fun `sends a text message that the contract knows`() {
    socket.connect(); awaitOpen()
    socket.send(DeviceToServer.PromptDone("p-0001"))
    assertEquals("""{"t":"prompt.done","promptId":"p-0001"}""", awaitTextOnServer())
}
@Test fun `connects again with backoff after the server closes`() {
    socket.connect(); awaitOpen()
    peer.close(1001, "bye"); awaitDown()
    assertFalse(socket.send(DeviceToServer.PromptDone("p-0001")))
    assertEquals(listOf(500L), scheduler.delays)
    scheduler.runNext(); awaitOpen()
    assertEquals(listOf("open", "down", "open"), events)
}
@Test fun `does not connect again after close`() {
    socket.connect(); awaitOpen(); socket.close()
    assertEquals(emptyList<Long>(), scheduler.delays)
}
@Test fun `the delay grows to 8 seconds and stays there`() {
    assertEquals(listOf(500L, 1000L, 2000L, 4000L, 8000L, 8000L), (0..5).map { Backoff().delayMs(it) })
}
```

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `./gradlew :core:test --tests "*net*"`
Expected: FAIL at compile time.

- [ ] **Step 3: Implement `GlanceApi`, `Backoff`, `DeviceSocket`**

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `./gradlew :core:test`
Expected: PASS for each test of `:core`.

- [ ] **Step 5: Write the fake server and try it**

Run in `tools/fake-server`: `npm install`, then `node server.mjs`, then `curl -X POST http://localhost:8080/api/sessions`
Expected: `fake server on :8080`, and the JSON of the table.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/android
git commit -m "feat(android): add the REST client, the device socket with reconnect, and a fake server"
```

---

### Task 13 [C2]: Bridge, WebView host, placeholder page

**Files:**
- Create: `core/src/main/kotlin/com/metaglance/core/bridge/Bridge.kt`
- Test: `core/src/test/kotlin/com/metaglance/core/bridge/BridgeTest.kt`
- Create: `app/src/main/kotlin/com/metaglance/android/bridge/WebBridge.kt`, `bridge/UiAssetsHandler.kt`, `session/ProfileStore.kt`, `MainActivity.kt`
- Create: `app/src/main/assets/placeholder/index.html`, `app/src/main/assets/placeholder/app.js`
- Modify: `app/build.gradle.kts`, `app/src/main/AndroidManifest.xml`, `app/src/debug/AndroidManifest.xml`

**Interfaces:**
- Consumes: `Codec`, `NativeToPage`, `PageToNative`, `Profiles` (Task 5). `Sensitivity` (Task 8). `StateMapper` (Task 11). `DatLink` (Task 2).
- Produces:

```kotlin
// core
object Bridge {
    const val INTERFACE_NAME = "GlanceNative"                // page to Kotlin: window.GlanceNative.postMessage(json)
    fun receiveCall(message: NativeToPage): String           // window.__glanceReceive("<JSON as a string literal>")
    fun mimeType(path: String): String
}
// app
class WebBridge(webView: WebView, onMessage: (PageToNative) -> Unit) { fun send(message: NativeToPage) }
class UiAssetsHandler(assets: AssetManager, root: String) : WebViewAssetLoader.PathHandler
class StoredSession(val sessionId: String, val token: String, val wsUrl: String, val live: Boolean)
class ProfileStore(context: Context) {          // SharedPreferences "glance"
    var profile: Profile                        // default Profiles.DEFAULT
    var wantedMainYes: MainYes                  // the choice of the shopper. Default HEAD.
    var serverSession: StoredSession?
    var serverUrl: String                       // default BuildConfig.SERVER_URL
    var sensitivity: Sensitivity                // default NORMAL
    var usePlaceholder: Boolean                 // default false
    fun clear()                                 // profile, wantedMainYes, and serverSession go back to their defaults
}
```

Decisions:

1. The page loads at `https://appassets.androidplatform.net/index.html`. `WebViewAssetLoader` has one handler at `/`: `UiAssetsHandler(assets, root)`. This works with the relative `base` of Plan 3 and with an absolute one. A debug build adds `?debug=1`, which shows the debug panel of Plan 3.
2. `root` is `ui` when the APK has `ui/index.html`. If not, it is `placeholder`. `ProfileStore.usePlaceholder` also selects `placeholder`: add a probe switch `Use placeholder page` for it. The checks of later tasks use the buttons of the placeholder page.
3. `UiAssetsHandler` opens `<root>/<path>`. A path with no file extension that is not a file gives `index.html`. The MIME type is `Bridge.mimeType`.
4. A debug build with a `UI_DEV_URL` that is not empty loads that URL.
5. WebView settings: `javaScriptEnabled = true`, `domStorageEnabled = true`, `allowFileAccess = false`, `allowContentAccess = false`, `textZoom = (resources.configuration.fontScale * 100).toInt()`.
6. `shouldOverrideUrlLoading`: a URL outside the page origin and the dev URL opens with `Intent.ACTION_VIEW`. The Play Store link for Meta AI uses this path.
7. `@JavascriptInterface fun postMessage(json: String)` moves to the main thread, decodes with `Codec.decodePageToNative`, and drops `null` with a log line.
8. `WebBridge.send` calls `evaluateJavascript(Bridge.receiveCall(message), null)`. It sends nothing before the first `ui.ready`.
9. On each `ui.ready`: `native.state`, then `profile`. Task 15 adds the snapshot.
10. `MainActivity` is an `AppCompatActivity`: portrait, `launchMode="singleTask"`, the launcher of the app, with the `glance` scheme filter. Remove that filter from `ProbeActivity`. Two activities with the same scheme make Android ask the user.
11. `MainActivity` sets `volumeControlStream = AudioManager.STREAM_MUSIC`.
12. `syncUi` copies the UI build into the APK. It does not run npm. Build the UI first: `npm run build --workspace @glance/phone-ui` at the repository root.
13. The theme of Plan 3 needs a WebView of Chrome 123 or later. If the page shows no theme, update Android System WebView on the phone.

`app/build.gradle.kts`, added:

```kotlin
val syncUi by tasks.registering(Sync::class) {
    from(rootDir.resolve("../ui/dist"))
    into(layout.buildDirectory.dir("generated/uiAssets/ui"))
}
android.sourceSets["main"].assets.srcDir(layout.buildDirectory.dir("generated/uiAssets"))
tasks.named("preBuild") { dependsOn(syncUi) }
```

The placeholder page stands in for the page of Plan 3, and it is the manual test tool of the bridge. `index.html` loads `app.js` as a module script. `app.js` does this:

- It sets `window.__glanceReceive`, then sends `ui.ready`.
- `#state` shows the last `native.state` as formatted JSON. `#profile` shows the last `profile`.
- `#prompt` shows the product name or the kiosk name of the last `glance.pending` or `checkout.offered`, with the buttons `Add` and `Skip`. They send `intent` `yes` and `no` with that `promptId`. `glance.cleared` empties it.
- `#captions` shows the text of the last five `caption` events. `#log` shows the last 20 messages.
- One button for each other message: `setup.register`, `setup.requestCamera`, `setup.openUpdate`, `session.start`, `session.end`, `intent undo`, `cart.edit` (`oat-drink-1l`, 0), `profile.set` for `speechRate` 1.5, for `haptics` false, for `mainYes` `key`, and for `mainYes` `voice`, `pocket.set` on and off, `haptic` for each of the 8 patterns, `data.delete`.

- [ ] **Step 1: Write the failing test**

```kotlin
@Test fun `wraps the message as one JavaScript string argument`() {
    val message = NativeToPage.ProfileChanged(Profiles.DEFAULT)
    val call = Bridge.receiveCall(message)
    assertTrue(call.startsWith("window.__glanceReceive(\"")); assertTrue(call.endsWith("\")"))
    val literal = call.removePrefix("window.__glanceReceive(").removeSuffix(")")
    assertEquals(Codec.encode(message), Json.decodeFromString<String>(literal))
}
@Test fun `escapes quotes, backslashes, and line breaks`() {
    val event = buildJsonObject { put("type", "error"); put("code", "x"); put("message", "a \"b\" \\ \n </script>") }
    val call = Bridge.receiveCall(NativeToPage.Event(event))
    assertFalse(call.contains("\n"))
    val literal = call.removePrefix("window.__glanceReceive(").removeSuffix(")")
    assertEquals(Codec.encode(NativeToPage.Event(event)), Json.decodeFromString<String>(literal))
}
@Test fun `knows the MIME types of a Vite build`() {
    assertEquals(listOf("text/html", "text/javascript", "text/javascript", "text/css", "image/svg+xml", "application/json",
        "font/woff2", "image/png", "application/wasm", "application/octet-stream"),
        listOf("index.html", "assets/index-abc.js", "a.mjs", "a.css", "a.svg", "a.json", "a.woff2", "a.png", "a.wasm", "a.unknown").map(Bridge::mimeType))
}
```

- [ ] **Step 2: Run the test and make sure it fails**

Run: `./gradlew :core:test --tests "*BridgeTest"`
Expected: FAIL at compile time.

- [ ] **Step 3: Implement `Bridge`, `WebBridge`, `UiAssetsHandler`, `ProfileStore`, `MainActivity`, the placeholder page, and `syncUi`**

- [ ] **Step 4: Run the test, then check the copy task**

Run: `./gradlew :core:test --tests "*BridgeTest"`
Expected: PASS.

If `apps/mobile/ui/dist` does not exist, make a test file: `mkdir -p ../ui/dist` and write `<html>ui</html>` to `../ui/dist/index.html`.
Run: `./gradlew :app:assembleDebug`, then `unzip -l app/build/outputs/apk/debug/app-debug.apk`
Expected: the list has `assets/ui/index.html` and `assets/placeholder/index.html`. Delete the test file after the check.

- [ ] **Step 5: Check on a phone or an emulator**

| # | Do | Expected |
|---|---|---|
| 1 | Install with no UI build. Open "Glance". | The placeholder page shows `native.state` and `profile` as JSON. Logcat has no MIME error for `app.js`. |
| 2 | Tap `profile.set speechRate 1.5`. | `#profile` shows `"speechRate": 1.5`. It is still there after an app restart. |
| 3 | Set the font size of the phone to the largest value. Open the app again. | The text of the page is larger. |
| 4 | Open "Glance Probe", tap `Mock: enable and pair`, return to "Glance". | `#state` shows `"mock": true` and a device with `"link": "connected"`. |
| 5 | Reload the page from Chrome on the laptop (`chrome://inspect`). | The page shows state and profile again. |

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/android
git commit -m "feat(android): host the phone UI in a WebView with the bridge and a placeholder page"
```

---

### Task 14 [C2]: Pipeline and audio adapters

**Files:**
- Create: `app/src/main/kotlin/com/metaglance/android/pipeline/FramePipeline.kt`, `audio/ExoLinePlayer.kt`
- Create: `apps/mobile/android/tools/make-sounds.mjs`, `app/src/main/res/raw/found.wav`, `added.wav`, `removed.wav`, `warning.wav`, `paid.wav`
- Modify: `app/src/debug/kotlin/com/metaglance/android/probe/ProbeActivity.kt`

**Interfaces:**
- Consumes: `QrScanner`, `RawFrame`, `I420` (Task 2). `KioskCode`, `KioskDwell` (Task 6). `Sharpness`, `SharpestFramePicker`, `UploadGate`, `FramePrep`, `FaceResult` (Task 7). `FrameHeader` (Task 5). `LinePlayer`, `PlayableLine` (Task 9). `PhoneVoice` (Task 3). `GlanceApi.clipUrl` (Task 12).
- Produces:

```kotlin
class FramePipeline(
    private val gate: () -> UploadSkip?,
    private val onKioskText: (String) -> Unit,                 // "GL1 K3X7", when the dwell rule reports
    private val onUpload: (FrameHeader, ByteArray) -> Unit,
    private val findFaces: ((RawFrame) -> FaceResult)? = null, // Task 18 sets it
    private val crop: Boolean = false,                         // Task 18 sets it to true
    private val log: (String) -> Unit,
) {
    fun onFrame(frame: RawFrame)        // call it on one background thread, for each frame
    fun close()
}
class ExoLinePlayer(context: Context, private val voice: PhoneVoice, private val clipUrl: (String) -> String) : LinePlayer
```

`FramePipeline.onFrame`, in this order:

1. `QrScanner.scan(I420.toNv21(...))`. Each hit goes through `KioskCode.parse`. The codes go to `KioskDwell.onFrame`. A reported code gives `onKioskText(KioskCode.format(code))`.
2. `SharpestFramePicker.offer` with `Sharpness.of`. With no frame back, stop here.
3. `gate()`. With a skip reason, drop the frame. Log the reason when it changes.
4. `faces = findFaces?.invoke(frame) ?: FaceResult.NotRun`, then `FramePrep.prepare(frame, faces, crop)`. `null` drops the frame with the log line `frame dropped: face detection failed`.
5. `Bitmap.createBitmap(argb, width, height, Bitmap.Config.ARGB_8888)`, then `compress(JPEG, 80)`.
6. `onUpload(FrameHeader(seq, System.currentTimeMillis(), width, height, blurred), jpeg)`. `seq` starts at 1 and grows by 1 for each upload.

The caller collects `DatLink.frames` on `Dispatchers.Default.limitedParallelism(1)`. The flow keeps only the newest frame, so the pipeline never queues.

`ExoLinePlayer`:

1. One `ExoPlayer`. Audio attributes: `C.USAGE_MEDIA` and `C.AUDIO_CONTENT_TYPE_SPEECH`, with `handleAudioFocus = true`. Playback uses the default media route: the glasses when they are connected, the phone speaker when they are not.
2. HTTP timeouts of 3000 ms: `DefaultMediaSourceFactory(DefaultDataSource.Factory(context, DefaultHttpDataSource.Factory().setConnectTimeoutMs(3000).setReadTimeoutMs(3000)))`.
3. A line is a playlist: the sound as `android.resource://<package>/<R.raw id>` when the line has one, then `clipUrl(line.url)`.
4. Speed: `PlaybackParameters(line.rate.toFloat().coerceIn(0.8f, 2.0f))`. The pitch stays 1.
5. `Player.STATE_ENDED` runs `onEnd`.
6. `onPlayerError`, or no `isPlaying` within 3 seconds after `play`: stop the player, speak `line.text` with `PhoneVoice` at the same rate, then run `onEnd`.
7. `line.phoneVoice`: play the sound if there is one, then speak `line.text` with `PhoneVoice`.
8. `stop()` stops the player and the phone voice, and drops the pending `onEnd`.
9. If the probe showed that audio must play on the phone: `player.setPreferredAudioDevice` with the device of type `TYPE_BUILTIN_SPEAKER`.

These Media3 names are from version 1.9. If one does not compile, read the Media3 reference. Do not guess.

`tools/make-sounds.mjs` writes the five files as 16-bit mono WAV at 44100 Hz. Each tone is a sine with a fade of 5 ms at both ends.

| File | Tones, Hz x ms |
|---|---|
| `found.wav` | 660 x 90, 880 x 120 |
| `added.wav` | 880 x 110 |
| `removed.wav` | 660 x 90, 440 x 140 |
| `warning.wav` | 330 x 120, silence 60, 330 x 120, silence 60, 330 x 120 |
| `paid.wav` | 523 x 90, 659 x 90, 784 x 220 |

- [ ] **Step 1: Make the sounds**

Run: `node tools/make-sounds.mjs`
Expected: five files in `app/src/main/res/raw/`, each shorter than 1 second.

- [ ] **Step 2: Implement `FramePipeline` and `ExoLinePlayer`**

- [ ] **Step 3: Add three probe buttons**

| Button | Action |
|---|---|
| `Pipeline test` | A switch. Run a `FramePipeline` on `DatLink.frames` with a gate that always passes. Log `upload seq=<n> <w>x<h> <bytes> bytes` and `kiosk <text>`. |
| `Play test line` | Play `PlayableLine("t", SoundName.FOUND, "<server URL>/clip.wav", "Test line.", Lang.EN, 1.0, false)`. Log `line ended`. |
| `Play bad clip` | The same line with the URL `<server URL>/missing.mp3`. |

- [ ] **Step 4: Check with MockDeviceKit and the fake server**

Start the fake server. Set `glance.serverUrl` to `http://<laptop address>:8080` and install. Start a mock session with the phone camera.

| # | Do | Expected |
|---|---|---|
| 1 | Enable `Pipeline test`. | About 2 `upload` lines each second. The long side is 768 or less. Each JPEG is smaller than 200 KB. |
| 2 | Point the phone at the `GL1 K3X7` code. | `kiosk GL1 K3X7` after about 1.5 seconds, then one line each second. |
| 3 | Tap `Play test line`. | The `found` sound, then the tone, then `line ended`. |
| 4 | Tap `Play bad clip`. | Within 3 seconds the phone voice says "Test line.", then `line ended`. |
| 5 | Run `grep -rn "getExternalFilesDir\|openFileOutput\|FileOutputStream" app/src/main`. | No match. Only the probe writes files. |

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/android
git commit -m "feat(android): add the frame pipeline and the line player with sounds"
```

---

### Task 15 [C2]: Session controller and the spine check

**Files:**
- Create: `app/src/main/kotlin/com/metaglance/android/session/SessionController.kt`
- Modify: `app/src/main/kotlin/com/metaglance/android/GlanceApp.kt`, `MainActivity.kt`

**Interfaces:**
- Consumes: each unit of Tasks 2 to 14.
- Produces:

```kotlin
class SessionController(app: Application, scope: CoroutineScope, val dat: DatLink, val store: ProfileStore) {
    val nativeState: StateFlow<NativeState>
    fun attachPage(send: (NativeToPage) -> Unit, activity: MainActivity); fun detachPage()
    fun onPageMessage(message: PageToNative)
    fun onVolumeKey(up: Boolean): Boolean                 // Task 21. Until then it returns false.
}
```

`GlanceApp` also owns the one `SessionController`, so a new activity keeps the session.

Page to Kotlin:

| Message | Action |
|---|---|
| `ui.ready` | Send `native.state` and `profile`. If a server session is live: `GlanceApi.snapshot`, then send `snapshot`. |
| `setup.register`, `setup.requestCamera`, `setup.openUpdate` | Task 16 |
| `session.start` | The start flow below |
| `session.end` | Send `Intent(STOP, PHONE)` if the socket is open. Then stop the DAT session at once. Plan 1 ends the server session and answers with "Camera off." and `session.end`. |
| `intent` | Send `Intent(kind, PHONE, promptId)` |
| `cart.edit` | Send `CartEdit` |
| `profile.set` | `Profiles.applyPatch`, save, send `profile` to the page, send `ProfileSet` to the server. A `mainYes` in the patch also sets `wantedMainYes`. |
| `pocket.set`, `haptic` | Task 19 |
| `data.delete` | Stop the DAT session. `GlanceApi.deleteSession`. Close the socket. `store.clear()`. Send `profile` and `native.state`. |

Server to Kotlin:

| Message | Action |
|---|---|
| `speak` | `PromptTracker.onPromptSpoken` if it has a `promptId`. Then `SpeechQueue.onSpeak`. |
| `event` | Send it to the page as it is. Decode it for `PromptTracker.onEvent`. |
| `snapshot` | Send it to the page. Take `session.profile` as the profile. |
| `session.rest` | Stop the DAT session. The socket and the server session stay. |
| `session.end` | Stop the DAT session. Mark the server session as not live. Close the socket after 5 seconds. Keep its ID and token for `data.delete`. |
| `biometric.request` | Task 24 |

Kotlin to server:

| Message | When |
|---|---|
| A frame | `FramePipeline.onUpload` |
| `kiosk.seen` | `FramePipeline.onKioskText`. The text is the full code text, for example `GL1 K3X7`. |
| `prompt.done` | `SpeechQueue.onPromptDone`. Call `PromptTracker.onPromptDone` at the same time. |
| `intent` from the head | `HeadInput.onSample` for each sample of `DatLink.gyro` |
| `device.state` | On each change of `StateMapper.deviceState`, and one time after each socket open |
| `profile.set` | When `MainYesResolver` gives another value than `profile.mainYes` |

Start flow:

1. Checks, in this order. Each failure sends its error event and stops the flow: Bluetooth granted (`BLUETOOTH_DENIED`), a connected device (`NO_DEVICE`), not `DOFFED` (`NOT_WORN`).
2. With no live server session: `GlanceApi.createSession(profile)` on `Dispatchers.IO`. Save the answer. A failure sends `SERVER_UNREACHABLE`.
3. Open the `DeviceSocket` with `GlanceApi.socketUrl(wsUrl)`, if it is not open.
4. `dat.startSession(withCamera = true, autoAttach = true)`.
5. Keep the screen on from here until the DAT session stops: `FLAG_KEEP_SCREEN_ON` on the window of `MainActivity`.
6. Five seconds after the first `STREAMING`: `MainYesResolver.resolve(store.wantedMainYes, motionStarted, inputsActive, speechStarted)`. If the result differs from `profile.mainYes`, apply it as a profile patch.

Stop handling:

1. When the DAT session reaches `STOPPED`, build `StopFacts` from the errors of this session and the device, and classify.
2. A cause other than APP sends its error event to the page.
3. With `autoRestart`: wait until `StopCauses.canStartNow(device)`, then start a new DAT session. The server session stays.
4. A pause needs no action. `device.state` reports it, and no frame arrives while the stream is paused.

Wiring:

- `SpeechQueue` with `ExoLinePlayer`. `soundOff` is "the volume of `STREAM_MUSIC` is 0". `rate` is `profile.speechRate`.
- `HeadInput` with `HeadGestureConfig.of(store.sensitivity, PITCH_AXIS, PITCH_DOWN_SIGN, YAW_AXIS)` from `ProbeDecisions`.
- `UploadGate.check(socket.isOpen, socket.queuedBytes(), device.worn)`.
- A timer each second calls `ConnectionAnnouncer.onTick`. A line goes to `SpeechQueue.sayLocal`.
- `nativeState` combines `dat.snapshot`, the phone network state from `ConnectivityManager`, and the socket state. Each change goes to the page as `native.state`.

- [ ] **Step 1: Implement `SessionController` and connect `MainActivity`**

- [ ] **Step 2: Build**

Run: `./gradlew :core:test :app:assembleDebug`
Expected: PASS and `BUILD SUCCESSFUL`.

- [ ] **Step 3: Spine check with MockDeviceKit and the fake server**

Add one probe button for this check: `Mock: nod`. It calls `motion.setMotionFeed(samples, loop = true)` with the samples of `GyroScript(config).rest(3000).pitch(0.26, 250).pitch(-0.26, 250).rest(500)`. The mock glasses then nod one time each 4 seconds.

Start the fake server. Enable mock mode in the probe, pair, select the phone camera. Open "Glance".

| # | Do | Expected |
|---|---|---|
| 1 | Tap `session.start`. | `#state`: `session` goes to `started`, `stream` to `streaming`. The phone plays the tone of "Camera on". The fake server logs `device.state` and about 2 frames each second. |
| 2 | Wait for the prompt. | The `found` sound and the tone play. `#prompt` shows "Oat drink". The fake server logs `prompt.done p-0001`. |
| 3 | Tap `Add` on the page. | The fake server logs `intent yes` with source `phone` and `p-0001`. The `added` sound plays. |
| 4 | Tap `Skip` on the next prompt. | `intent no`, source `phone`. |
| 5 | In the probe, tap `Mock: nod`. Return to "Glance". Wait for the next prompt. | One `intent yes` with source `head` and the `promptId`, at most 5 seconds after `prompt.done`. No intent arrives between two prompts. |
| 6 | Point the phone at the `GL1 K3X7` code. | `kiosk.seen GL1 K3X7` one time each second. The pay prompt plays, and the mock nod pays: the `paid` sound. The camera stops: `stream` is `stopped`. The screen can turn off again. |
| 7 | Tap `session.start` again. | A second `POST /api/sessions` on the fake server. |
| 8 | Type `rest` in the fake server. Then tap `session.start`. | The camera stops. The start makes no new `POST`. |
| 9 | Type `badclip`. | The phone voice says the line. `prompt.done` arrives after it. |
| 10 | Stop the fake server for 10 seconds, then start it. | `network` is `offline`. After 3 seconds the phone voice says "Connection lost. Your cart is safe. Glances are paused." No frame goes out. Then `network` is `online`, and `device.state` arrives again. |
| 11 | Reload the page with `chrome://inspect` during a session. | State, profile, and snapshot arrive again. |

When Plan 1 reached its Task 12, repeat rows 1 to 6 against `npm run dev:fake --workspace @glance/server`. Its lines have no clip, so the phone voice speaks them.

- [ ] **Step 4: Spine check on the glasses with a fake server (stream: 4 minutes)**

| # | Do | Expected |
|---|---|---|
| 1 | Disable mock mode. Wear the glasses. Tap `session.start`. | The capture LED is on. The "Camera on" tone plays in the glasses. |
| 2 | Wait for the prompt. Nod. | The fake server logs `intent yes`, source `head`. The `added` sound plays in the glasses. |
| 3 | Wait for the next prompt. Shake the head. | `intent no`, source `head`. |
| 4 | Wait for a prompt and do nothing for 10 seconds. Then nod. | No intent. Rule R21: silence never adds. |
| 5 | Look at the `GL1 K3X7` code from 1 m. Nod on the pay prompt. | `kiosk.seen`, then `intent yes`. The LED is off after the paid line. |

- [ ] **Step 5: M1 on the glasses with the real server (stream: 5 minutes)**

Needs Plan 1 on the team domain and the catalog products. Set `glance.serverUrl` to the HTTPS URL. Install.

| # | Do | Expected |
|---|---|---|
| 1 | Tap `session.start`. | "Camera on. Hold a product up to hear its price." in the glasses. |
| 2 | Hold a catalog product up. | Its name and price in the glasses within about 4 seconds. This is M1. Write down the seconds. |
| 3 | Nod. | "Added ...", with the product name and the total. |
| 4 | Hold another product up. Shake the head. | "Skipped." |
| 5 | Look at the code of the kiosk page. Nod on the pay prompt. | "Paid. ..." The kiosk page shows "Paid". The LED is off. |

- [ ] **Step 6: Commit and open the pull request**

```bash
git add apps/mobile/android
git commit -m "feat(android): add the session controller that connects glasses, server, and page"
```

Open a pull request for `feat/android-c2`. Start `feat/android-c3` from it.

---

### Task 16 [C3]: Setup flow

**Files:**
- Modify: `app/src/main/kotlin/com/metaglance/android/MainActivity.kt`, `session/SessionController.kt`

**Interfaces:**
- Consumes: `DatLink` (Task 2), `SessionController` (Task 15), `NativeErrors` (Task 11).
- Produces: the handlers for `setup.register`, `setup.requestCamera`, and `setup.openUpdate`.

Decisions:

1. At the first resume, `MainActivity` requests `BLUETOOTH_CONNECT` on Android 12 or later, then calls `dat.initialize(granted)`. On Android 10 and 11 it calls `dat.initialize(true)`.
2. No SDK call runs before `initialize(true)`. With the permission denied, `registration` is `unavailable`.
3. `setup.register` with the permission denied: request the permission again. If Android does not show the prompt, send `BLUETOOTH_DENIED`. With the permission granted: `dat.register(activity)`.
4. `setup.requestCamera`: launch `Wearables.RequestPermissionContract()` with `Permission.CAMERA`. Give the result to `dat.onPermissionResult`. A failure other than `META_AI_NOT_INSTALLED` sends `PERMISSION_FAILED`.
5. `setup.openUpdate`: `dat.openUpdate(activity)`.
6. `MainActivity` calls `Wearables.handleIntent(intent) { it.continueRegistration(this) }` in `onCreate` and in `onNewIntent`, after `initialize(true)`.
7. `onResume` calls `dat.refreshPermissions()`. The shopper returns from Meta AI through this path.
8. A registration error `FAILED_TO_REGISTER` or `UNKNOWN` sends `REGISTRATION_FAILED`. The page reads "no internet" from `network`.

- [ ] **Step 1: Implement the handlers**

- [ ] **Step 2: Check with MockDeviceKit**

Add two probe buttons for this check: `Mock: enable, not registered` (`enable(registered = false)`, then `pair()`) and `Mock: deny camera` (`permissions.set(Permission.CAMERA, PermissionStatus.Denied)` and `setRequestResult` with `Denied`).

| # | Do | Expected |
|---|---|---|
| 1 | Install on a phone with Android 12 or later. Open "Glance". Deny the Bluetooth prompt. | No crash. `registration` is `unavailable`. (Review Focus 4) |
| 2 | Tap `setup.register`. | The prompt shows again, or the page logs an `error` event with `native.bluetooth_denied`. |
| 3 | Allow Bluetooth. Tap `Mock: enable, not registered`. | `registration` is `available`. |
| 4 | Tap `setup.register`. | `registering`, then `registered`. |
| 5 | Tap `Mock: deny camera`, then `setup.requestCamera`. | `cameraPermission` is `denied`. |
| 6 | Set the mock result to `Granted`. Tap `setup.requestCamera`. | `cameraPermission` is `granted`. |

- [ ] **Step 3: Check on the glasses (stream: 0 minutes)**

Remove the registration first: Meta AI app, Settings, App connections, remove Glance.

| # | Do | Expected |
|---|---|---|
| 1 | Open "Glance". | `registration` is `available`. |
| 2 | Tap `setup.register`. Confirm in Meta AI. | The app returns by itself. `registered`. A device with `"link": "connected"` and a battery value. |
| 3 | Tap `setup.requestCamera`. Select "Allow always". | `cameraPermission` is `granted`. |
| 4 | Fold the glasses. | `device.hingeOpen` is `false`, then `link` is `disconnected`. |

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/android
git commit -m "feat(android): add the setup flow for registration and the camera permission"
```

---

### Task 17 [C3]: Mock menu, device and error states

**Files:**
- Create: `app/src/main/kotlin/com/metaglance/android/mock/MockMenuActivity.kt`
- Modify: `app/src/main/AndroidManifest.xml`, `mock/MockGlassesController.kt`, `dat/DatLink.kt`, `session/SessionController.kt`, `README.md`

**Interfaces:**
- Consumes: `MockGlassesController` (Task 2), `GyroScript` (Task 8), `SessionController` (Task 15), `StateMapper` (Task 11).
- Produces: the mock menu, and three debug hooks:

```kotlin
// DatLink
fun debugFault(fault: DatFault)                       // goes through the same path as an SDK error. A STREAM fault also stops the session.
fun debugOverride(metaAiInstalled: Boolean? = null, compatibility: DatCompatibility? = null)
// SessionController
fun debugDropSocket(forMs: Long)                      // close the socket and connect again only after forMs
```

MockDeviceKit has no call for a stream error, for device compatibility, or for a missing Meta AI app, so the two `DatLink` hooks exist. Before you write them, run `search_dat_docs` with `Android MockDeviceKit stream error compatibility`. If a mock call exists now, use it.

`MockMenuActivity` is a second launcher activity with the label "Glance Mock", in each build type. Its top line shows `NativeState` and `DeviceState` as JSON, live. Build the layout in code. The menu:

| Group | Items and calls |
|---|---|
| Mode | `Enable (registered)`, `Enable (not registered)`, `Disable`. Each change of mode stops a running session first. |
| Glasses | `Pair`, `Power on`, `Power off`, `Don`, `Doff`, `Fold`, `Unfold` |
| Camera | `Phone camera` (asks for the Android camera permission), `Still image` (a picker, then `camera.setCapturedImage`) |
| State | `Battery 100`, `20`, `10`, `3` (`setBatteryLevel`). `Thermal none`, `severe`, `critical` (`setThermalLevel`). |
| Touchpad | `Tap` (`captouch.tap()`), `Tap and hold` (`captouch.tapAndHold()`), `Double tap` (`input.select(InputSource.CAPTOUCH)`), `Swipe` (`input.navDown()`) |
| Registration | `Next registration fails`, `Next registration works` (`simulateRegistrationOutcome`). `Camera: deny`, `Camera: allow` (`permissions.set` and `setRequestResult`). |
| Motion | `Replay nod`, `Replay shake`: `motion.setMotionFeed(samples, loop = false)` with the samples of `GyroScript`. `Replay CSV file`: a picker, copy to the cache, `motion.setMotionFeed(Uri.fromFile(file))`. |
| Speech | `Say add`, `Say skip` (`speech.simulateTranscription(text, isFinal = true, confidence = 0.9f)`) |
| Force | `Meta AI missing`, `Update required`, `Stream error BATTERY_LOW`, `Stream error THERMAL_HOT` (the debug hooks) |
| App | `Server URL` (a text field, saved in `ProfileStore.serverUrl`). `Drop server link 10 s`. `Sensitivity: gentle, normal, firm`. `Use placeholder page`. |

- [ ] **Step 1: Implement the menu and the hooks**

- [ ] **Step 2: Check each state of spec section 6.6**

Run a fake server. Enable mock mode, pair, select the phone camera. Start a session from the page. Read the top line of the mock menu, the log of the page, and the log of the server.

| # | State | Menu action | Expected |
|---|---|---|---|
| 1 | Meta AI app missing | `Meta AI missing` | `metaAiInstalled` is `false`. |
| 2 | Not registered | `Enable (not registered)`, `Pair` | `registration` is `available`. `setup.register` gives `registered`. |
| 3 | No internet at registration | `Next registration fails`, airplane mode, `setup.register` | `registration` returns to `available`. Event `native.registration_failed`. `network` is `offline`. Write down the error name of the log. |
| 4 | Camera permission denied | `Camera: deny` | `cameraPermission` is `denied`. `Camera: allow`, then `setup.requestCamera`, gives `granted`. |
| 5 | Glasses not found | `Power off`, no session | `device.link` is `disconnected`, or `device` is `null`. `session.start` sends `native.no_device`. |
| 6 | Update required | `Update required` | `device.updateRequired` is `true`. `setup.openUpdate` returns with no crash. In mock mode the log can show a `NavigationError`. |
| 7 | Paused | `Tap` during a session | `session` or `stream` is `paused`. The server gets `device.state` with `paused`. No frame goes out. No new session starts. `Tap` again: `streaming`. |
| 8 | Stopped by the device | `Tap and hold` | `session` is `stopped`. Event `native.stopped_by_device`. No new session starts. `session.start` starts one. |
| 9 | Hinge closed | `Fold` during a session, then `Unfold`, `Don` | Event `native.hinge_closed`. `device.hingeOpen` is `false`. After `Unfold`, a new session starts by itself, and the server session is the same. |
| 10 | Link lost | `Power off` during a session, then `Power on`, `Unfold`, `Don` | Event `native.link_lost`. After the glasses return, a new session starts by itself. |
| 11 | Glasses off the face | `Doff` during a session | `device.worn` is `false`. No frame goes out. `Don`: frames go out again. |
| 12 | Start off the face | `Doff`, then `session.start` | Event `native.not_worn`. No session starts. |
| 13 | Battery at 20 and 10 percent | `Battery 20`, `Battery 10` | `device.battery` follows. The server gets each `device.state`. |
| 14 | Battery too low | `Battery 3`, `Stream error BATTERY_LOW` | The session stops. Event `native.battery_low`. `device.state` has `battery` 3 and `stream` `stopped`. No new session starts. |
| 15 | Too warm | `Thermal critical`, `Stream error THERMAL_HOT` | The session stops. Event `native.too_warm`. `device.state` has `thermal` 6. |
| 16 | Server not reachable | `Drop server link 10 s` | `network` is `offline`. The phone voice says the "Connection lost" line after 3 seconds. Then `online`, and `device.state` goes out again. |
| 17 | Recognition slow, payment failed | These states come from the server. | The page gets each `event`, and each `speak` plays. Check them with the server of Plan 1. |

- [ ] **Step 3: Check on the glasses (stream: 4 minutes)**

Use the notes of Task 4, rows 12 to 16, as the expected SDK behavior.

| # | Do | Expected |
|---|---|---|
| 1 | Start a session. Tap the touchpad one time. | `paused` in `#state`. The server of Plan 1 says "Paused. Tap the side of your glasses to resume." No new session starts. Tap again: `streaming`. |
| 2 | Tap and hold. | `stopped`, event `native.stopped_by_device`, "Camera off." |
| 3 | Start a session. Remove the glasses. Wear them. | `worn` is `false`, and no frame goes out. Frames go out again when worn. |
| 4 | Fold the glasses. Unfold them and wear them. | Event `native.hinge_closed`. A new session starts by itself. The cart of the server session is the same. |

- [ ] **Step 4: Update the README and commit**

Add one part to `README.md`: "Mock mode for seats without glasses", with the steps `Enable (registered)`, `Pair`, `Phone camera`, `Server URL`, and `session.start`.

```bash
git add apps/mobile/android
git commit -m "feat(android): add the mock menu and handle each device and error state"
```

---

### Task 18 [C3]: Face blur and crop

**Files:**
- Create: `core/src/main/kotlin/com/metaglance/core/image/Pixelate.kt`, `app/src/main/kotlin/com/metaglance/android/pipeline/FaceFinder.kt`
- Modify: `core/src/main/kotlin/com/metaglance/core/image/FrameGeometry.kt`, `FramePrep.kt`, `app/src/main/kotlin/com/metaglance/android/session/SessionController.kt`
- Test: `core/src/test/kotlin/com/metaglance/core/image/PixelateTest.kt`, and `GeometryTest.kt`, `FramePrepTest.kt` get new tests

**Interfaces:**
- Consumes: `FramePrep`, `FaceResult`, `RectPx`, `FrameGeometry` (Task 7). `FramePipeline` (Task 14).
- Produces:

```kotlin
object Pixelate { fun apply(argb: IntArray, width: Int, height: Int, boxes: List<RectPx>) }   // in place
// added to FrameGeometry
fun mapBox(box: RectPx, crop: RectPx, outWidth: Int, outHeight: Int): RectPx?   // null when the box is outside the crop
// app
class FaceFinder {
    fun find(frame: RawFrame): FaceResult        // ML Kit on NV21. Each failure gives FaceResult.Failed.
    fun find(bitmap: Bitmap): FaceResult         // for the still of Task 25
    fun close()
}
```

Rules:

1. `Pixelate.apply` grows each box by 20 percent of its size on each side and clips it to the image. The block size is `max(8, width / 6)`, with the width of the box before it grows. The blocks start at the left and top edge of the grown box. Each block gets the color of its center pixel.
2. `mapBox` clips the box to the crop and scales it to the output. It rounds the left and top edges down and the right and bottom edges up, so a face is never covered less.
3. `FramePrep.prepare` with `Found`: `cropScaleToArgb`, then `mapBox` for each box, then `Pixelate.apply`.
4. `FaceFinder` uses `FaceDetection.getClient` with `PERFORMANCE_MODE_FAST` and `setMinFaceSize(0.05f)`, and `Tasks.await`.
5. `SessionController` builds the pipeline with `findFaces = { faceFinder.find(it) }` and `crop = true`. Each upload then has `blurred: true`.

- [ ] **Step 1: Write the failing tests**

```kotlin
// PixelateTest. image(w, h) makes pixels with argb[i] = i.
@Test fun `gives each block inside a box one color and leaves the rest`() {
    val px = image(100, 100); Pixelate.apply(px, 100, 100, listOf(RectPx(40, 40, 30, 30)))
    assertEquals(px[35 * 100 + 35], px[36 * 100 + 36])        // inside the grown box, same block
    assertEquals(0, px[0]); assertEquals(99 * 100 + 99, px[99 * 100 + 99])
}
@Test fun `clips a box at the image edge and accepts an empty list`() {
    val px = image(50, 50); Pixelate.apply(px, 50, 50, listOf(RectPx(40, 40, 30, 30), RectPx(-10, -10, 5, 5)))
    val same = image(50, 50); Pixelate.apply(same, 50, 50, emptyList())
    assertArrayEquals(image(50, 50), same)
}

// GeometryTest
@Test fun `maps a face box into the cropped output and never makes it smaller`() {
    val crop = RectPx(72, 192, 576, 896)
    assertEquals(RectPx(0, 0, 86, 86), FrameGeometry.mapBox(RectPx(72, 192, 100, 100), crop, 494, 768))
    assertEquals(RectPx(0, 0, 67, 86), FrameGeometry.mapBox(RectPx(50, 192, 100, 100), crop, 494, 768))
    assertNull(FrameGeometry.mapBox(RectPx(0, 0, 50, 50), crop, 494, 768))
}

// FramePrepTest
@Test fun `pixelates a found face in the output`() {
    val f = noiseFrame(720, 1280)                                                 // each Y byte differs from its neighbors
    val out = FramePrep.prepare(f, FaceResult.Found(listOf(RectPx(300, 600, 120, 120))), crop = true)!!
    val x = ((300 - 72) * 494 / 576) + 20; val y = ((600 - 192) * 768 / 896) + 20
    assertEquals(out.argb[y * out.width + x], out.argb[y * out.width + x + 1])
    assertTrue(out.blurred); assertEquals(494 to 768, out.width to out.height)
}
```

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `./gradlew :core:test --tests "*image*"`
Expected: FAIL at compile time.

- [ ] **Step 3: Implement `Pixelate`, `mapBox`, the `Found` branch, `FaceFinder`, and the wiring**

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `./gradlew :core:test --tests "*image*"`
Expected: PASS.

- [ ] **Step 5: Check with MockDeviceKit and on the glasses (stream: 2 minutes)**

Start the fake server with `SAVE_FRAMES=1`.

| # | Do | Expected |
|---|---|---|
| 1 | Mock session with the phone camera. Point it at a photo of a face. Open `glance-last.jpg` in the temp folder. | The face is pixelated. The server logs `blurred=true`. |
| 2 | Point it at a product. | A sharp product. The frame is smaller than the camera view. |
| 3 | On the glasses: start a session and look at a person who agreed to the test. Open `glance-last.jpg`. | `494x768` in the log. The face is pixelated. Delete the file after the check. |

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/android
git commit -m "feat(android): pixelate faces and crop each frame before the upload"
```

---

### Task 19 [C3]: Haptics and pocket mode

**Files:**
- Create: `core/src/main/kotlin/com/metaglance/core/state/HapticPatterns.kt`
- Test: `core/src/test/kotlin/com/metaglance/core/state/HapticPatternsTest.kt`
- Modify: `app/src/main/kotlin/com/metaglance/android/MainActivity.kt`, `session/SessionController.kt`

**Interfaces:**
- Consumes: `HapticPattern` (Task 5), `SessionController` (Task 15).
- Produces: `object HapticPatterns { fun timings(pattern: HapticPattern): LongArray }` and the handlers for `haptic` and `pocket.set`.

The timings are in ms: pause, vibration, pause, vibration.

| Pattern | Timings |
|---|---|
| `prompt` | 0, 40 |
| `added` | 0, 40, 80, 40 |
| `removed` | 0, 200 |
| `warning` | 0, 120, 80, 120, 80, 120 |
| `paid` | 0, 40, 80, 40, 80, 300 |
| `error` | 0, 300, 150, 300 |
| `cameraPaused` | 0, 60, 120, 60, 600, 60, 120, 60, 600, 60, 120, 60 |
| `cameraOff` | 0, 400, 200, 400, 200, 400 |

Decisions:

1. `haptic`: if `profile.haptics` is true, `vibrate(VibrationEffect.createWaveform(timings, -1))`. Kotlin never vibrates by itself. The page of Plan 3 selects each pattern with its `hapticFor`, also `cameraPaused` and `cameraOff`.
2. `pocket.set` on: `window.attributes.screenBrightness = 0.01f`, hide the system bars with `WindowInsetsControllerCompat` and `BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE`, and keep the screen on.
3. `pocket.set` off: brightness `BRIGHTNESS_OVERRIDE_NONE`, show the system bars. The screen stays on only while a session runs.
4. The page draws the black screen and blocks touches. Kotlin does not.

- [ ] **Step 1: Write the failing test**

```kotlin
@Test fun `has a different pattern for each name, and each starts with a pause of 0`() {
    val all = HapticPattern.values().map { HapticPatterns.timings(it).toList() }
    assertEquals(8, all.toSet().size)
    for (t in all) { assertEquals(0L, t.first()); assertEquals(0, t.size % 2); assertTrue(t.sum() <= 2500) }
}
@Test fun `has the timings of the plan`() {
    assertArrayEquals(longArrayOf(0, 40, 80, 40), HapticPatterns.timings(HapticPattern.ADDED))
    assertArrayEquals(longArrayOf(0, 400, 200, 400, 200, 400), HapticPatterns.timings(HapticPattern.CAMERA_OFF))
}
```

- [ ] **Step 2: Run the test and make sure it fails**

Run: `./gradlew :core:test --tests "*HapticPatternsTest"`
Expected: FAIL at compile time.

- [ ] **Step 3: Implement the table and the two handlers**

- [ ] **Step 4: Run the test, then check on a phone**

Run: `./gradlew :core:test --tests "*HapticPatternsTest"`
Expected: PASS.

| # | Do | Expected |
|---|---|---|
| 1 | Tap each of the 8 `haptic` buttons of the placeholder page. | Eight patterns that a hand can tell apart. |
| 2 | Tap `profile.set haptics false` on the placeholder page. Tap a `haptic` button. | No vibration. |
| 3 | Tap `pocket.set on`. Wait one minute. | The screen is dim and stays on. The system bars are hidden. |
| 4 | Tap `pocket.set off` with no session. Wait for the screen timeout. | Normal brightness. The screen turns off. |

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/android
git commit -m "feat(android): add the haptic patterns and the native side of pocket mode"
```

---

### Task 20 [C3]: Signed demo APK

**Files:**
- Modify: `app/build.gradle.kts`, `README.md`

**Interfaces:**
- Consumes: the app of Tasks 1 to 19.
- Produces: `glance-demo.apk` and its SHA-256 for seat 4. Plan 4 Task 8 publishes it as a release asset.

`app/build.gradle.kts`, inside `android`:

```kotlin
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
```

The `demo` build has no probe and no cleartext traffic, because both live in `app/src/debug`. It has mock mode. The spec uses mock mode as the fallback of the live demo.

- [ ] **Step 1: Make the keystore**

Run in `apps/mobile/android/app`, with a password of the team:

```bash
keytool -genkeypair -v -keystore glance-demo.jks -alias glance-demo -keyalg RSA -keysize 2048 -validity 3650 -storepass <password> -keypass <password> -dname "CN=Meta Glance Demo"
```

`keytool` is in the `bin` folder of the Android Studio JDK. Git ignores `*.jks`. Give the file and the password to one other team member. An update with another key needs an uninstall first.

Add to `local.properties`: `glance.demoStorePassword`, `glance.demoKeyPassword`, and `glance.serverUrl` with the HTTPS URL of the team domain.

- [ ] **Step 2: Build the UI, then the APK**

Build the page of Plan 3 first: `npm run build --workspace @glance/phone-ui` at the repository root.

Run: `./gradlew :core:test :app:assembleDemo`
Expected: PASS, and `app/build/outputs/apk/demo/app-demo.apk`.

- [ ] **Step 3: Check the APK**

| # | Do | Expected |
|---|---|---|
| 1 | Run `apksigner verify --print-certs app/build/outputs/apk/demo/app-demo.apk`. `apksigner` is in `build-tools` of the Android SDK. | `Signer #1 certificate DN: CN=Meta Glance Demo` |
| 2 | Run `unzip -l app/build/outputs/apk/demo/app-demo.apk`. | The list has `assets/ui/index.html`. |
| 3 | Uninstall the debug app. Run `adb install app/build/outputs/apk/demo/app-demo.apk`. | The launcher shows "Glance" and "Glance Mock". It does not show "Glance Probe". |
| 4 | Open "Glance" with the glasses. Run the setup and one glance against the real server. | The page of Plan 3 loads. A glance speaks. |
| 5 | Run `grep -rn "startBluetoothSco\|setCommunicationDevice\|MODE_IN_COMMUNICATION\|RECORD_AUDIO" app/src`. | No match. |

- [ ] **Step 4: Give the APK to seat 4**

Copy the file as `glance-demo.apk`. Compute the SHA-256: `Get-FileHash glance-demo.apk -Algorithm SHA256` in PowerShell. Give both to seat 4.

- [ ] **Step 5: Commit and open the pull request**

Add the keystore steps and the `demo` keys to `README.md`.

```bash
git add apps/mobile/android
git commit -m "chore(android): add the signed demo build"
```

Open a pull request for `feat/android-c3`.

---

### Task 21 [Extra, core if the probe selects it]: Volume keys as yes and no

**Files:**
- Create: `core/src/main/kotlin/com/metaglance/core/input/KeyInput.kt`
- Test: `core/src/test/kotlin/com/metaglance/core/input/KeyInputTest.kt`
- Modify: `app/src/main/kotlin/com/metaglance/android/MainActivity.kt`, `session/SessionController.kt`

**Interfaces:**
- Consumes: `PromptTracker` (Task 10), `SessionController.onVolumeKey` (Task 15).
- Produces: `object KeyInput { fun intentFor(up: Boolean, mainYes: MainYes, currentPromptId: String?): IntentKind? }`

Rules:

1. Volume up is `yes` and volume down is `no`, only when `profile.mainYes` is `key` and a prompt is current.
2. In each other case the key changes the volume as usual.
3. `MainActivity.onKeyDown` for `KEYCODE_VOLUME_UP` and `KEYCODE_VOLUME_DOWN` calls `controller.onVolumeKey(up)`. A `true` result consumes the key down and its key up. A repeat event (`repeatCount > 0`) is consumed and sends nothing.
4. The controller sends `Intent(kind, IntentSource.KEY, promptId)`.

- [ ] **Step 1: Write the failing test**

```kotlin
@Test fun `the volume keys answer a current prompt only when they are the main yes`() {
    assertEquals(IntentKind.YES, KeyInput.intentFor(up = true, MainYes.KEY, "p-0001"))
    assertEquals(IntentKind.NO, KeyInput.intentFor(up = false, MainYes.KEY, "p-0001"))
    assertNull(KeyInput.intentFor(up = true, MainYes.KEY, null))
    assertNull(KeyInput.intentFor(up = true, MainYes.HEAD, "p-0001"))
}
```

- [ ] **Step 2: Run the test and make sure it fails**

Run: `./gradlew :core:test --tests "*KeyInputTest"`
Expected: FAIL at compile time.

- [ ] **Step 3: Implement `KeyInput` and the key handling**

- [ ] **Step 4: Run the test, then check with the fake server**

Run: `./gradlew :core:test --tests "*KeyInputTest"`
Expected: PASS.

| # | Do | Expected |
|---|---|---|
| 1 | Mock session. Tap `profile.set mainYes key`. Wait for a prompt. Press volume up. | The fake server logs `intent yes`, source `key`. The volume does not change. |
| 2 | Press volume down on the next prompt. | `intent no`, source `key`. |
| 3 | Press volume up with no prompt. | The volume changes. No intent. |
| 4 | Enable pocket mode. Press volume up on a prompt. | `intent yes`. |

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/android
git commit -m "feat(android): add the volume keys as yes and no"
```

---

### Task 22 [Extra]: Double tap and swipe

**Files:**
- Create: `core/src/main/kotlin/com/metaglance/core/input/TouchInput.kt`
- Test: `core/src/test/kotlin/com/metaglance/core/input/TouchInputTest.kt`
- Modify: `app/src/main/kotlin/com/metaglance/android/session/SessionController.kt`

**Interfaces:**
- Consumes: `TouchEvent` (Task 3), `PromptTracker` (Task 10), `DatLink.touches`, `ProbeDecisions.INPUTS` and `INPUT_SOURCES` (Task 3, measured in Task 4).
- Produces: `object TouchInput { fun intentFor(event: TouchEvent, lastFinishedPromptId: String?): DeviceToServer.Intent }`

Rules:

1. A double tap is `Intent(YES, TOUCH, lastFinishedPromptId)`. The server decides if it counts (rule R5).
2. A swipe in each direction is `Intent(REPEAT, TOUCH)`.
3. `autoAttach` attaches Inputs with `INPUT_SOURCES` when `ProbeDecisions.INPUTS` is true.
4. No feature depends on the touchpad alone. The docs warn that a gesture may not reach the app.

- [ ] **Step 1: Write the failing test**

```kotlin
@Test fun `a double tap is a yes for the last finished prompt, and a swipe repeats`() {
    assertEquals(DeviceToServer.Intent(IntentKind.YES, IntentSource.TOUCH, "p-0001"), TouchInput.intentFor(TouchEvent.DOUBLE_TAP, "p-0001"))
    assertEquals(DeviceToServer.Intent(IntentKind.YES, IntentSource.TOUCH), TouchInput.intentFor(TouchEvent.DOUBLE_TAP, null))
    assertEquals(DeviceToServer.Intent(IntentKind.REPEAT, IntentSource.TOUCH), TouchInput.intentFor(TouchEvent.SWIPE, "p-0001"))
}
```

- [ ] **Step 2: Run the test and make sure it fails**

Run: `./gradlew :core:test --tests "*TouchInputTest"`
Expected: FAIL at compile time.

- [ ] **Step 3: Implement `TouchInput` and collect `DatLink.touches` in the controller**

- [ ] **Step 4: Run the test, then check with MockDeviceKit and on the glasses (stream: 2 minutes)**

Run: `./gradlew :core:test --tests "*TouchInputTest"`
Expected: PASS.

| # | Do | Expected |
|---|---|---|
| 1 | Mock session. Wait for a prompt. Tap `Double tap` in the mock menu. | `intent yes`, source `touch`, with the `promptId`. `capabilities.inputs` is `true`. |
| 2 | Tap `Swipe`. | `intent repeat`, source `touch`. |
| 3 | On the glasses: double tap after a prompt. Swipe after a line. | The same two intents. The line plays again after the swipe. |
| 4 | On the glasses: tap one time. | The session pauses. This tap belongs to the device. |

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/android
git commit -m "feat(android): add double tap as yes and swipe as repeat"
```

---

### Task 23 [Extra]: Voice commands

**Files:**
- Create: `core/src/main/kotlin/com/metaglance/core/input/VoiceInput.kt`
- Test: `core/src/test/kotlin/com/metaglance/core/input/VoiceInputTest.kt`
- Modify: `app/src/main/kotlin/com/metaglance/android/session/SessionController.kt`, `MainActivity.kt`

**Interfaces:**
- Consumes: `Transcript` (Task 3), `SpeechQueue.isMuted` (Task 9), `DatLink.transcripts`, `ProbeDecisions.SPEECH` (Task 3). The server of Plan 1 (its Task 11) turns `speech.final` into an intent with `parseVoiceCommand`.
- Produces:

```kotlin
object VoiceInput { fun onTranscript(t: Transcript, muted: Boolean): DeviceToServer.SpeechFinal? }
```

Rules:

1. The app sends each final transcript as `speech.final`. It does not map words to intents. The server owns the command words, and it drops a result with a confidence below 0.5.
2. `onTranscript` returns `null` for a result that is not final, for a blank text, and for `muted`.
3. `muted` is `SpeechQueue.isMuted(now)`: the microphone hears each line, so the app ignores results while a line plays and for 500 ms after it.
4. `confidence` is the value of the glasses. With no value, send 0.5: the contract has no "not available", and the server drops a lower value.
5. `locale` is the locale of the glasses, or `und` when it is not known.
6. The bridge has no message for the microphone permission. The app asks for `Permission.MICROPHONE` when the page sets `mainYes` to `voice`, and when the page sends an intent with the kind `ask`. `autoAttach` attaches Speech when `ProbeDecisions.SPEECH` is true and the permission is granted.
7. `IntentKind` has the value `ask` (Plan 0, added after the cross-check). The page sends it for the microphone button. The app relays it to the server as each other page intent, with the source `phone` and no prompt ID. The server of Plan 1 (its Task 26) opens the question window, and the next final transcript is the question.

- [ ] **Step 1: Write the failing test**

```kotlin
private fun final(text: String, confidence: Float? = 0.9f) = Transcript(text, true, confidence, "en_US")

@Test fun `sends a final transcript as text`() {
    val out = VoiceInput.onTranscript(final("add"), muted = false)!!
    assertEquals("add", out.text); assertEquals(0.9, out.confidence, 0.001); assertEquals("en_US", out.locale)
}
@Test fun `ignores a result while a line plays, a partial result, and a blank text`() {
    assertNull(VoiceInput.onTranscript(final("add"), muted = true))
    assertNull(VoiceInput.onTranscript(Transcript("add", false, 0.9f, "en_US"), muted = false))
    assertNull(VoiceInput.onTranscript(final("  "), muted = false))
}
@Test fun `sends 0.5 when the glasses give no confidence, and und when they give no locale`() {
    val out = VoiceInput.onTranscript(Transcript("add", true, null, null), muted = false)!!
    assertEquals(0.5, out.confidence, 0.0); assertEquals("und", out.locale)
}
```

- [ ] **Step 2: Run the test and make sure it fails**

Run: `./gradlew :core:test --tests "*VoiceInputTest"`
Expected: FAIL at compile time.

- [ ] **Step 3: Implement `VoiceInput`, the permission request, and the wiring**

- [ ] **Step 4: Run the test, then check with MockDeviceKit and on the glasses (stream: 3 minutes)**

Run: `./gradlew :core:test --tests "*VoiceInputTest"`
Expected: PASS.

| # | Do | Expected |
|---|---|---|
| 1 | Mock session with a fake server. Tap `Say add` in the mock menu while a prompt plays. | The server logs no `speech.final`. |
| 2 | Tap `Say add` one second after the prompt ended. | The server logs `speech.final` with the text `add`. The server of Plan 1 adds the product. |
| 3 | On the glasses: tap `profile.set mainYes voice`. Allow the microphone in Meta AI. Start a session. | `capabilities.speech` is `true`. |
| 4 | Let a prompt play to its end. Say "add". | One `speech.final` with `add`. No `speech.final` holds the words of the prompt. |
| 5 | Say "add" for two prompts in a row. | Two messages. If the second is missing, the `StateFlow` dropped an equal result: write it in the probe results file. |

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/android
git commit -m "feat(android): send speech results to the server with the mute time after each line"
```

---

### Task 24 [Extra 6]: Fingerprint above 50 EUR

**Files:**
- Modify: `app/src/main/kotlin/com/metaglance/android/MainActivity.kt`, `session/SessionController.kt`

**Interfaces:**
- Consumes: `ServerToDevice.BiometricRequest`, `DeviceToServer.BiometricResult` (Task 5). `NativeErrors.BIOMETRIC_UNAVAILABLE` (Task 11). Plan 1 Task 27 sends the request.
- Produces: the handler for `biometric.request`.

Decisions:

1. Use `androidx.biometric.BiometricPrompt` with `BIOMETRIC_WEAK or DEVICE_CREDENTIAL`. This pair works from Android 10. Set no negative button text: the device credential replaces it.
2. Title "Confirm payment". Subtitle "Demo payment. No money moves."
3. `onAuthenticationSucceeded` sends `BiometricResult(true)`. `onAuthenticationError` sends `BiometricResult(false)`: this covers a cancel. `onAuthenticationFailed` sends nothing, because the prompt stays open.
4. If `BiometricManager.canAuthenticate` does not return `BIOMETRIC_SUCCESS`: send `BiometricResult(false)` and the event `BIOMETRIC_UNAVAILABLE`.
5. In pocket mode, set the brightness to `BRIGHTNESS_OVERRIDE_NONE` while the prompt shows. Set it back after the result.

- [ ] **Step 1: Implement the handler**

- [ ] **Step 2: Check with the fake server on a phone**

| # | Do | Expected |
|---|---|---|
| 1 | Start a session. Type `bio` in the fake server. Use the fingerprint. | The system prompt shows. The fake server logs `biometric.result ok=true`. |
| 2 | Type `bio`. Cancel the prompt. | `biometric.result ok=false` |
| 3 | Enable pocket mode. Type `bio`. | The screen is bright while the prompt shows, and dim after it. |
| 4 | On a phone or an emulator with no screen lock: type `bio`. | `ok=false`, and the page logs `native.biometric_unavailable`. |

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/android
git commit -m "feat(android): confirm a payment above 50 EUR with the biometric prompt"
```

---

### Task 25 [Extra 9]: Sharp second look

**Files:**
- Create: `core/src/main/kotlin/com/metaglance/core/image/StillPolicy.kt`
- Test: `core/src/test/kotlin/com/metaglance/core/image/StillPolicyTest.kt`
- Modify: `app/src/main/kotlin/com/metaglance/android/session/SessionController.kt`

**Interfaces:**
- Consumes: `DatLink.captureStill` (Task 3), `FaceFinder.find(bitmap)`, `Pixelate`, `FrameGeometry` (Tasks 7 and 18), `FrameHeader` with `FrameKind.STILL` (Task 5). The event `glance.ambiguous` of Plan 0. Plan 1 Task 30 reads the still.
- Produces:

```kotlin
class StillPolicy(private val everyMs: Long = 5000) {
    fun tryStart(nowMs: Long): Boolean     // false while a capture runs, and for everyMs after the last start
    fun onEnd()
}
```

Decisions:

1. Each `glance.ambiguous` event asks `StillPolicy.tryStart`. On `true`, call `dat.captureStill()`.
2. Prepare the bitmap: `FaceFinder.find(bitmap)`. `Failed` drops the still. Crop with `FrameGeometry.centerCrop`. Scale the long side to 1440 at most. Pixelate each face box.
3. Encode as JPEG at quality 85. Send it with `FrameHeader(seq, ts, w, h, blurred = true, kind = FrameKind.STILL)`.
4. A still does not pass the upload gate of the stream, but it needs an open socket.
5. A still can stop Motion, Inputs, and Speech. The revive rule of Task 3 starts them again. Read the notes of Task 4, row 11.
6. Log the milliseconds from the event to the upload.

- [ ] **Step 1: Write the failing test**

```kotlin
@Test fun `allows one capture at a time, and one each 5 seconds`() {
    val p = StillPolicy()
    assertTrue(p.tryStart(1000)); assertFalse(p.tryStart(1500))
    p.onEnd()
    assertFalse(p.tryStart(5999)); assertTrue(p.tryStart(6000))
}
```

- [ ] **Step 2: Run the test and make sure it fails**

Run: `./gradlew :core:test --tests "*StillPolicyTest"`
Expected: FAIL at compile time.

- [ ] **Step 3: Implement `StillPolicy` and the still path in the controller**

- [ ] **Step 4: Run the test, then check with MockDeviceKit and on the glasses (stream: 3 minutes)**

Run: `./gradlew :core:test --tests "*StillPolicyTest"`
Expected: PASS.

| # | Do | Expected |
|---|---|---|
| 1 | Mock session. Select a `Still image` in the mock menu. Type `amb` in the fake server. | The server logs one frame with `kind=still blurred=true`. |
| 2 | Type `amb` two times within one second. | One still. |
| 3 | On the glasses: start a session, hold a product up, type `amb`. | One still. Write down its size and the milliseconds. |
| 4 | Wait for the next prompt. Nod. | `intent yes`, source `head`. The log shows `revive motion` if the still stopped Motion. |
| 5 | If row 4 fails | Cut this task. A dead nod costs more than a sharper frame. |

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/android
git commit -m "feat(android): send a still photo for look-alike products"
```
