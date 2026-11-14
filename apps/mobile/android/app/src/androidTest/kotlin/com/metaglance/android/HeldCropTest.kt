package com.metaglance.android

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.metaglance.android.support.FakeServerTestCase
import com.metaglance.android.support.HeldCropRule
import com.metaglance.android.support.TestClips
import com.metaglance.android.support.TrafficRecorder
import com.metaglance.android.support.waitUntil
import com.metaglance.core.contract.DeviceToServer
import com.metaglance.core.contract.StreamStatus
import com.metaglance.core.frame.FrameSize
import com.metaglance.core.frame.FrameView
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The held crop with mock glasses, against the fake server of the app. No clip shows a product in a hand, so
 * these tests cover the uploads with no region, and the code scan beside them. A crop of a held product needs
 * the glasses: see "The crop of the held product" in the README.
 *
 * These tests did not run after they were written: they need the test phone. They compile.
 */
@RunWith(AndroidJUnit4::class)
class HeldCropTest : FakeServerTestCase() {
    @get:Rule(order = 1)
    val heldCrop = HeldCropRule()

    @Test
    fun withNoRegionTheFullFrameGoesOutOneTimeEachSecond() {
        startSession(TestClips.SCENE)
        Thread.sleep(WATCH_MS)
        val frames = traffic.frames.toList()
        val full = frames.filter { it.header.view == FrameView.FULL }

        assertTrue("An upload has no view: ${views(frames)}", frames.all { it.header.view != null })
        assertTrue("An upload has no source size: ${views(frames)}", frames.all { it.header.source == SOURCE })
        // A full frame has the size of an upload of before the crop, and it went through face detection.
        for (frame in full) assertEquals(UPLOAD_SIZE, frame.header.w to frame.header.h)
        assertTrue("An upload went out with no face detection.", frames.all { it.header.blurred })
        // One full frame each second with no region. A region in the plain scene gives crops, which is no failure.
        assertTrue("${full.size} full frames in $WATCH_MS ms", full.size <= WATCH_MS / FULL_EVERY_MS + 2)
        for ((first, second) in full.zipWithNext()) {
            assertTrue("Two full frames ${second.atMs - first.atMs} ms apart", second.atMs - first.atMs >= FULL_EVERY_MS - CLOCK_SLACK_MS)
        }
        for (crop in frames.filter { it.header.view == FrameView.CROP }) {
            val place = checkNotNull(crop.header.crop) { "The crop ${crop.header.seq} has no place." }
            assertEquals("A crop of the stream has the pixels of the frame.", place.w to place.h, crop.header.w to crop.header.h)
            assertTrue("The crop $place is outside the frame.", place.x + place.w <= SOURCE.w && place.y + place.h <= SOURCE.h)
        }
        assertEquals(StreamStatus.STREAMING, native.stream)
        assertEquals("Error events of the app: ${traffic.nativeErrors}", emptyList<String>(), traffic.nativeErrors.toList())
    }

    // The kiosk code is read on the phone, in the full frame. It needs no upload and no product in a hand.
    @Test
    fun theKioskCodeGivesKioskSeenWithTheHeldCropOn() {
        startSession(TestClips.KIOSK)
        waitUntil("kiosk.seen goes out with the code text", CODE_MS, ::state) { traffic.sent<DeviceToServer.KioskSeen> { it.text == TestClips.KIOSK_TEXT } != null }
        awaitServerLog("the kiosk code") { it == "kiosk.seen ${TestClips.KIOSK_TEXT}" }
    }

    // The barcode is read on the phone, in the full frame, also in a window that uploads nothing.
    @Test
    fun aBarcodeGivesBarcodeSeenWithTheHeldCropOn() {
        startSession(TestClips.BARCODE)
        waitUntil("barcode.seen goes out", CODE_MS, ::state) { traffic.sent<DeviceToServer.BarcodeSeen> { it.code == TestClips.BARCODE_TEXT } != null }
    }

    private fun views(frames: List<TrafficRecorder.Frame>) = frames.map { "${it.header.seq}:${it.header.view}:${it.header.source}" }

    private companion object {
        val SOURCE = FrameSize(720, 1280)
        val UPLOAD_SIZE = 432 to 768
        const val WATCH_MS = 5000L
        const val FULL_EVERY_MS = 1000L

        /** The recorder reads the time of an upload after the socket took it. */
        const val CLOCK_SLACK_MS = 150L
        const val CODE_MS = 15_000L
    }
}
