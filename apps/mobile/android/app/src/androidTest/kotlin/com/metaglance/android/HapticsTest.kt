package com.metaglance.android

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.metaglance.android.support.FakeServerTestCase
import com.metaglance.android.support.GlanceTestRunner
import com.metaglance.android.support.waitFor
import com.metaglance.android.support.waitUntil
import com.metaglance.core.contract.IntentKind
import com.metaglance.core.contract.PageToNative
import com.metaglance.core.contract.ServerEvent
import com.metaglance.core.contract.StreamStatus
import com.metaglance.core.state.HapticPattern
import com.metaglance.core.state.HapticPatterns
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The vibrations of a session. The app selects each one from the messages of the server and from the state of
 * the camera, with no message of the page, so they also play while the screen is off.
 *
 * The test runner takes each vibration in place of the phone. So the phone stays quiet, and the test reads the
 * timings that the app asked for.
 */
@RunWith(AndroidJUnit4::class)
class HapticsTest : FakeServerTestCase() {
    @Before
    override fun setUp() {
        super.setUp()
        GlanceTestRunner.vibrations.clear()
    }

    @Test
    fun aPromptAnAddAnErrorAndAStoppedCameraEachGiveTheirPattern() {
        startSession()
        // The command sends a product prompt. Its clip is missing, and that has no effect on the vibration.
        command("badclip")
        val pending = waitFor("the product prompt arrives", STEP_MS, ::state) { traffic.event<ServerEvent.GlancePending>() }
        awaitVibration(HapticPattern.PROMPT)

        page(PageToNative.Intent(IntentKind.YES, pending.promptId))
        awaitVibration(HapticPattern.ADDED)

        command("slow")
        awaitVibration(HapticPattern.ERROR)

        command("rest")
        waitUntil("the stream stops", STEP_MS, ::state) { native.stream == StreamStatus.STOPPED }
        awaitVibration(HapticPattern.CAMERA_OFF)
    }

    @Test
    fun noVibrationPlaysWithHapticsOffInTheProfile() {
        startSession()
        // The snapshot of the server brings a profile with haptics on, so the patch comes after the start.
        page(PageToNative.ProfileSet(buildJsonObject { put("haptics", false) }))
        waitUntil("the profile has haptics off", STEP_MS, ::state) { !glance.profileStore.profile.haptics }
        GlanceTestRunner.vibrations.clear()
        command("badclip")
        val pending = waitFor("the product prompt arrives", STEP_MS, ::state) { traffic.event<ServerEvent.GlancePending>() }
        page(PageToNative.Intent(IntentKind.YES, pending.promptId))
        waitFor("the cart gets the product", STEP_MS, ::state) { traffic.event<ServerEvent.CartUpdated>() }
        assertEquals(emptyList<List<Long>>(), GlanceTestRunner.vibrations.toList())
    }

    private fun awaitVibration(pattern: HapticPattern) {
        val timings = HapticPatterns.timings(pattern).toList()
        waitUntil("the vibration $pattern plays", STEP_MS, { "vibrations=${GlanceTestRunner.vibrations} ${state()}" }) { timings in GlanceTestRunner.vibrations }
    }
}
