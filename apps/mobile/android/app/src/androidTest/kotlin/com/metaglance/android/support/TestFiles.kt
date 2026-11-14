package com.metaglance.android.support

import android.content.Context
import android.media.AudioManager
import android.net.Uri
import androidx.test.platform.app.InstrumentationRegistry
import com.metaglance.core.contract.GlanceJson
import java.io.File
import java.io.FileOutputStream
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.OkHttpClient
import okhttp3.Request
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue

/** The clips of `scripts/integration/android/make-clips.mjs`, in the assets of the test APK. */
object TestClips {
    const val SCENE = "scene.mp4"
    const val KIOSK = "kiosk.mp4"
    const val SCENE_IMAGE = "scene.png"
    const val KIOSK_TEXT = "GL1 K3X7"

    /** A sharp EAN-13 code with its digits, as a clip and as a still image. */
    const val BARCODE = "barcode.mp4"
    const val BARCODE_IMAGE = "barcode.png"
    const val BARCODE_TEXT = "4006381333931"

    /** The digits of a code with no bars. */
    const val DIGITS = "barcode-digits.mp4"
    const val DIGITS_TEXT = "8076809513753"

    /** Bars that no scanner decodes, with no digits and with sharp digits. */
    const val BLURRED = "barcode-blurred.mp4"
    const val BLURRED_DIGITS = "barcode-blurred-digits.mp4"
    const val BLURRED_TEXT = "3017624010701"
    const val FRAME_SIZE = "720x1280"
}

/** Copies an asset of the test APK to the cache of the app, because the mock camera takes a file address. */
fun assetUri(assetName: String): Uri {
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    val outFile = File(instrumentation.targetContext.cacheDir, assetName)
    instrumentation.context.assets.open(assetName).use { input ->
        FileOutputStream(outFile).use { output -> input.copyTo(output) }
    }
    return Uri.fromFile(outFile)
}

/** The phone voice speaks each line that has no clip. A test must never make a sound. */
fun requireSilentPhone(context: Context) {
    val audio = context.getSystemService(AudioManager::class.java)
    assertEquals("Set the media volume of the phone to 0 before the tests.", 0, audio.getStreamVolume(AudioManager.STREAM_MUSIC))
}

fun <R> onMainSync(block: () -> R): R {
    var result: Result<R>? = null
    InstrumentationRegistry.getInstrumentation().runOnMainSync { result = runCatching(block) }
    return checkNotNull(result).getOrThrow()
}

/**
 * Fails unless the server at `serverUrl` runs with fake recognition and fake speech.
 * A server with the real services costs money for each frame and each line.
 */
fun requireFakeServer(serverUrl: String) {
    val health = OkHttpClient().newCall(Request.Builder().url("$serverUrl/healthz").build()).execute().use { response ->
        assertTrue("GET /healthz gave the status ${response.code}.", response.isSuccessful)
        GlanceJson.parseToJsonElement(response.body?.string().orEmpty()).jsonObject
    }
    assertTrue("The server does not run with fake recognition.", health["fakeRecognition"]?.jsonPrimitive?.boolean == true)
    assertTrue("The server does not run with fake speech.", health["fakeSpeech"]?.jsonPrimitive?.boolean == true)
}
