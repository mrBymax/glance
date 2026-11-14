package com.metaglance.android

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.metaglance.android.support.FakeServerTestCase
import com.metaglance.android.support.TestClips
import com.metaglance.android.support.TrafficRecorder
import com.metaglance.android.support.assetUri
import com.metaglance.android.support.waitFor
import com.metaglance.android.support.waitUntil
import com.metaglance.core.contract.DeviceToServer
import com.metaglance.core.contract.IntentKind
import com.metaglance.core.contract.IntentSource
import com.metaglance.core.contract.ServerEvent
import com.metaglance.core.contract.StreamStatus
import com.metaglance.core.frame.FrameKind
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The sharp second look: rows 1 and 2 of the table of Plan 2 Task 25 Step 4, and row 4 with a mock nod.
 * The command `amb` of the fake server sends `glance.ambiguous`, and the mock glasses give the image of the
 * plain scene as the still photo. That image has 720 x 1280 pixels, so the upload is its center crop with no scale.
 */
@RunWith(AndroidJUnit4::class)
class StillPhotoTest : FakeServerTestCase() {
    @Test
    fun anAmbiguousGlanceSendsOneStillWithItsFacesHidden() {
        startSessionWithStillImage()
        command("amb")

        val still = waitFor("a still goes out", STILL_MS, ::state) { stills().firstOrNull() }
        assertEquals(FrameKind.STILL, still.header.kind)
        assertTrue("The still did not go through face detection.", still.header.blurred)
        assertEquals("${STILL_WIDTH}x$STILL_HEIGHT", "${still.header.w}x${still.header.h}")
        assertTrue("The still has ${still.jpegBytes} bytes.", still.jpegBytes > MIN_JPEG_BYTES)
        awaitServerLog("the still") { it.startsWith("frame seq=${still.header.seq} ${STILL_WIDTH}x$STILL_HEIGHT blurred=true kind=still ") }

        // The frames of the stream go on, and each upload has a number of its own.
        val framesBefore = traffic.frames.size
        waitUntil("frames go out after the still", STEP_MS, ::state) { traffic.frames.size > framesBefore + 1 }
        val numbers = traffic.frames.map { it.header.seq }
        assertEquals("Two uploads have the same number: $numbers", numbers.size, numbers.toSet().size)
        assertEquals(StreamStatus.STREAMING, native.stream)
        assertEquals("Error events of the app: ${traffic.nativeErrors}", emptyList<String>(), traffic.nativeErrors.toList())
    }

    @Test
    fun twoAmbiguousGlancesWithinOneSecondSendOneStill() {
        startSessionWithStillImage()
        // One fake server runs for each test of a run, so its log holds the stills of the tests before this one.
        val loggedBefore = stillsInServerLog()
        command("amb")
        command("amb")
        waitUntil("both events arrive", STEP_MS, ::state) { traffic.events().count { it is ServerEvent.GlanceAmbiguous } == 2 }
        waitUntil("a still goes out", STILL_MS, ::state) { stills().isNotEmpty() }
        Thread.sleep(QUIET_MS)
        assertEquals(1, stills().size)
        assertEquals(loggedBefore + 1, stillsInServerLog())
    }

    @Test
    fun aNodAnswersAPromptAfterAStill() {
        startSessionWithStillImage()
        waitUntil("Motion runs", STEP_MS, ::state) { native.capabilities.motion }
        command("amb")
        waitUntil("a still goes out", STILL_MS, ::state) { stills().isNotEmpty() }

        // A still can stop Motion on the glasses, and the app then starts it again. The mock glasses show that
        // a prompt after a still gets its answer from the head.
        command("badclip")
        val pending = waitFor("the product prompt arrives", STEP_MS, ::state) { traffic.event<ServerEvent.GlancePending>() }
        waitUntil("prompt.done goes out", STEP_MS, ::state) { traffic.sent<DeviceToServer.PromptDone> { it.promptId == pending.promptId } != null }
        waitUntil("Motion runs", STEP_MS, ::state) { native.capabilities.motion }
        playNod()
        waitUntil("the nod sends a yes for the prompt", NOD_MS, ::state) {
            traffic.sent<DeviceToServer.Intent> { it.kind == IntentKind.YES && it.source == IntentSource.HEAD && it.promptId == pending.promptId } != null
        }
    }

    private fun startSessionWithStillImage() {
        startSession()
        val image = assetUri(TestClips.SCENE_IMAGE)
        onMain { glasses.services.camera.setCapturedImage(image) }
    }

    private fun stillsInServerLog(): Int = serverLog().count { " kind=still " in it }

    private fun stills(): List<TrafficRecorder.Frame> = traffic.frames.filter { it.header.kind == FrameKind.STILL }

    private companion object {
        /** The center 80 percent of 720 pixels and 70 percent of 1280 pixels. */
        const val STILL_WIDTH = 576
        const val STILL_HEIGHT = 896
        const val MIN_JPEG_BYTES = 1000
        const val STILL_MS = 15_000L
        const val QUIET_MS = 3_000L
        const val NOD_MS = 8_000L
    }
}
