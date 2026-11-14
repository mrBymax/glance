package com.metaglance.android

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.metaglance.android.pipeline.QrScanner
import com.metaglance.android.support.MockDeviceKitTestCase
import com.metaglance.android.support.TestClips
import com.metaglance.android.support.waitFor
import com.metaglance.android.support.waitUntil
import com.metaglance.core.image.I420
import com.metaglance.core.image.RawFrame
import com.metaglance.core.state.DatDon
import com.metaglance.core.state.DatHinge
import com.metaglance.core.state.DatLinkState
import com.metaglance.core.state.DatSession
import com.metaglance.core.state.DatStream
import java.util.concurrent.atomic.AtomicReference
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/** The MockDeviceKit checks of Plan 2 Task 2 Step 6, with a video file in place of the phone camera. */
@RunWith(AndroidJUnit4::class)
class ProbeLinkTest : MockDeviceKitTestCase<MainActivity>(MainActivity::class.java) {
    private val newest = AtomicReference<RawFrame?>()

    @Test
    fun pairedGlassesAreRegisteredConnectedOpenAndWorn() {
        pairGlasses()
        val device = checkNotNull(glance.datLink.snapshot.value.device)
        assertEquals(DatLinkState.CONNECTED, device.link)
        assertEquals(DatDon.DONNED, device.don)
        assertEquals(DatHinge.OPEN, device.hinge)
        assertTrue("log: $datLog", datLog.contains("registration REGISTERED"))
        assertTrue("log: $datLog", datLog.any { it.startsWith("device ") && "link=CONNECTED" in it && "don=DONNED" in it && "hinge=OPEN" in it })
    }

    @Test
    fun aSessionStreamsFramesOfTheFeed() {
        pairGlasses()
        setCameraFeed(TestClips.SCENE)
        startSession()
        waitUntil("the log has a frame line", STREAM_MS, { datLog.toString() }) { datLog.any { FRAME_LINE.matches(it) } }
        assertTrue("log: $datLog", datLog.contains("session STARTED"))
        assertTrue("log: $datLog", datLog.contains("stream STREAMING"))
        assertEquals(TestClips.FRAME_SIZE, glance.datLink.frameSize)
    }

    @Test
    fun aFrameHasTheColorsOfTheScene() {
        pairGlasses()
        setCameraFeed(TestClips.SCENE)
        val collector = collectFrames()
        startSession()
        val frame = waitFor("a frame arrives", STREAM_MS) { newest.get() }
        collector.cancel()

        // The boxes of scripts/integration/android/make-clips.mjs, read at their centers. A buffer that is not
        // I420 with the U plane first shows red as blue.
        assertColor("red box", frame, 180, 360) { r, g, b -> r > 150 && g < 90 && b < 90 }
        assertColor("green box", frame, 540, 360) { r, g, b -> g > 110 && r < 90 && b < 110 }
        assertColor("blue box", frame, 180, 920) { r, g, b -> b > 150 && r < 90 && g < 120 }
        assertColor("yellow box", frame, 540, 920) { r, g, b -> r > 180 && g > 150 && b < 90 }
        assertColor("background", frame, 360, 640) { r, g, b -> r > 180 && g > 180 && b > 160 }
    }

    @Test
    fun theScannerReadsTheKioskCode() {
        pairGlasses()
        setCameraFeed(TestClips.KIOSK)
        val collector = collectFrames()
        startSession()
        val scanner = QrScanner()
        try {
            val hit = waitFor("the scanner reads a code", STREAM_MS) {
                newest.getAndSet(null)?.let { frame -> scanner.scan(I420.toNv21(frame.i420, frame.width, frame.height), frame.width, frame.height).firstOrNull() }
            }
            assertEquals(TestClips.KIOSK_TEXT, hit.text)
            assertTrue("area ${hit.areaPx}", hit.areaPx > 0)
        } finally {
            scanner.close()
            collector.cancel()
        }
    }

    // Measured with DAT 1.0.1: a running stream keeps its feed, also when the file starts again from its start.
    @Test
    fun aNewFeedShowsInTheNextStream() {
        pairGlasses()
        setCameraFeed(TestClips.SCENE)
        val collector = collectFrames()
        startSession()
        waitFor("a frame arrives", STREAM_MS) { newest.get() }
        setCameraFeed(TestClips.KIOSK)
        onMain { glance.datLink.stopSession() }
        waitUntil("the session stops", STREAM_MS, { datLog.toString() }) { glance.datLink.snapshot.value.session == DatSession.STOPPED }
        newest.set(null)
        startSession()
        val scanner = QrScanner()
        try {
            val hit = waitFor("the scanner reads the code of the new feed", STREAM_MS) {
                newest.getAndSet(null)?.let { frame -> scanner.scan(I420.toNv21(frame.i420, frame.width, frame.height), frame.width, frame.height).firstOrNull() }
            }
            assertEquals(TestClips.KIOSK_TEXT, hit.text)
        } finally {
            scanner.close()
            collector.cancel()
        }
    }

    @Test
    fun aStoppedSessionGivesWayToANewOne() {
        pairGlasses()
        setCameraFeed(TestClips.SCENE)
        startSession()
        onMain { glance.datLink.stopSession() }
        waitUntil("the log has session STOPPED", STREAM_MS, { datLog.toString() }) { datLog.contains("session STOPPED") }
        assertEquals(DatStream.STOPPED, glance.datLink.snapshot.value.stream)

        datLog.clear()
        startSession()
        assertTrue("log: $datLog", datLog.contains("stream STREAMING"))
    }

    // Without the wait in DatLink, the video decoder of the SDK ends the app process in one of a few rounds.
    @Test
    fun aStopAtTheStartOfTheStreamDoesNotEndTheApp() {
        pairGlasses()
        setCameraFeed(TestClips.SCENE)
        repeat(STOP_ROUNDS) {
            startSession()
            onMain { glance.datLink.stopSession() }
            waitUntil("the session stops", STREAM_MS, { datLog.takeLast(LOG_TAIL).toString() }) { glance.datLink.snapshot.value.session == DatSession.STOPPED }
        }
    }

    private fun startSession() {
        assertTrue("startSession returned false. log: $datLog", onMain { glance.datLink.startSession(withCamera = true) })
        waitUntil("the stream reaches STREAMING", STREAM_MS, { datLog.toString() }) {
            val snapshot = glance.datLink.snapshot.value
            snapshot.session == DatSession.STARTED && snapshot.stream == DatStream.STREAMING
        }
    }

    private fun collectFrames(): Job = glance.scope.launch { glance.datLink.frames.collect { newest.set(it) } }

    private fun assertColor(name: String, frame: RawFrame, x: Int, y: Int, expected: (Int, Int, Int) -> Boolean) {
        val (r, g, b) = rgbAt(frame, x, y)
        assertTrue("$name at $x,$y is rgb($r, $g, $b)", expected(r, g, b))
    }

    // BT.709 with limited range, as the app reads a frame.
    private fun rgbAt(frame: RawFrame, x: Int, y: Int): Triple<Int, Int, Int> {
        val w = frame.width
        val h = frame.height
        val luma = (frame.i420[y * w + x].toInt() and 0xFF) - 16
        val chromaIndex = (y / 2) * (w / 2) + x / 2
        val u = (frame.i420[w * h + chromaIndex].toInt() and 0xFF) - 128
        val v = (frame.i420[w * h + (w / 2) * (h / 2) + chromaIndex].toInt() and 0xFF) - 128
        val r = 1.164 * luma + 1.793 * v
        val g = 1.164 * luma - 0.213 * u - 0.533 * v
        val b = 1.164 * luma + 2.112 * u
        return Triple(r.toInt().coerceIn(0, 255), g.toInt().coerceIn(0, 255), b.toInt().coerceIn(0, 255))
    }

    private companion object {
        const val STREAM_MS = 15_000L
        const val STOP_ROUNDS = 6
        const val LOG_TAIL = 8
        val FRAME_LINE = Regex("""frame 720x1280 #\d+ fps=\d+\.\d""")
    }
}
