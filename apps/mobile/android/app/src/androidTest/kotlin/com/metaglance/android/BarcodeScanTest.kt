package com.metaglance.android

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.metaglance.android.support.FakeServerTestCase
import com.metaglance.android.support.TestClips
import com.metaglance.android.support.TrafficRecorder
import com.metaglance.android.support.assetUri
import com.metaglance.android.support.waitFor
import com.metaglance.android.support.waitUntil
import com.metaglance.core.contract.BarcodeSource
import com.metaglance.core.contract.DeviceToServer
import com.metaglance.core.contract.ServerToDevice
import com.metaglance.core.contract.StillPurpose
import com.metaglance.core.contract.StreamStatus
import com.metaglance.core.frame.FrameKind
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The barcode of a product in the stream of the mock glasses, against the fake server of the app.
 * The clips are from `scripts/integration/android/make-clips.mjs`: a sharp EAN-13 code, its digits with no bars,
 * and bars with a blur that the scanner cannot decode. The mock glasses give the image that the test sets as the
 * still photo, so a test selects what the phone reads in the still.
 */
@RunWith(AndroidJUnit4::class)
class BarcodeScanTest : FakeServerTestCase() {
    @Test
    fun aBarcodeInViewGivesBarcodeSeenOneTimeEachSecond() {
        startSession(TestClips.BARCODE)

        val first = waitFor("barcode.seen goes out", CODE_MS, ::state) { traffic.sent<DeviceToServer.BarcodeSeen>() }
        assertEquals(DeviceToServer.BarcodeSeen(TestClips.BARCODE_TEXT, BarcodeSource.BARCODE), first)
        awaitServerLog("the code") { it == "barcode.seen ${TestClips.BARCODE_TEXT} source=barcode" }

        // The mock stream has 30 frames each second, and the code is in each one. The phone reports it one time
        // each second, so 3 seconds give 3 more reports.
        Thread.sleep(REPEAT_WINDOW_MS)
        val reports = barcodes()
        assertTrue("${reports.size} reports in ${REPEAT_WINDOW_MS} ms after the first one", reports.size in 3..5)
        assertEquals(setOf(first), reports.toSet())

        assertNull("A kiosk code went out.", traffic.sent<DeviceToServer.KioskSeen>())
        assertEquals("A code in view needs no still.", emptyList<TrafficRecorder.Frame>(), labels())
        assertEquals(StreamStatus.STREAMING, native.stream)
        assertEquals("Error events of the app: ${traffic.nativeErrors}", emptyList<String>(), traffic.nativeErrors.toList())
    }

    @Test
    fun digitsWithNoBarsNeverGiveAWrongCode() {
        startSession(TestClips.DIGITS)
        Thread.sleep(WATCH_MS)
        // With no bars the scanner can find no region, and then OCR does not run. Both results are right.
        for (report in barcodes()) assertEquals(DeviceToServer.BarcodeSeen(TestClips.DIGITS_TEXT, BarcodeSource.OCR), report)
    }

    @Test
    fun sharpDigitsUnderBlurredBarsNeverGiveAWrongCode() {
        startSession(TestClips.BLURRED_DIGITS)
        useStillImage(TestClips.SCENE_IMAGE)
        Thread.sleep(WATCH_MS)
        for (report in barcodes()) assertEquals(TestClips.BLURRED_TEXT, report.code)
    }

    @Test
    fun theKioskCodeStillGivesKioskSeenAndNoBarcode() {
        startSession(TestClips.KIOSK)
        waitUntil("kiosk.seen goes out with the code text", CODE_MS, ::state) { traffic.sent<DeviceToServer.KioskSeen> { it.text == TestClips.KIOSK_TEXT } != null }
        awaitServerLog("the kiosk code") { it == "kiosk.seen ${TestClips.KIOSK_TEXT}" }
        // Longer than the time after which a barcode region asks for a still.
        Thread.sleep(QUIET_MS)
        assertEquals(emptyList<DeviceToServer.BarcodeSeen>(), barcodes())
        assertEquals("The QR code of a kiosk is no barcode region.", emptyList<TrafficRecorder.Frame>(), labels())
    }

    @Test
    fun aBarcodeThatDoesNotDecodeGivesOneLabelFrame() {
        startSession(TestClips.BLURRED)
        useStillImage(TestClips.SCENE_IMAGE)

        val label = waitFor("a label frame goes out", LABEL_MS, ::state) { labels().firstOrNull() }
        assertTrue("The label frame did not go through face detection.", label.header.blurred)
        // The still of the mock glasses is the image of the plain scene. A label frame has no crop.
        assertEquals(TestClips.FRAME_SIZE, "${label.header.w}x${label.header.h}")
        assertTrue("The label frame has ${label.jpegBytes} bytes.", label.jpegBytes > MIN_JPEG_BYTES)
        awaitServerLog("the label frame") { it.startsWith("frame seq=${label.header.seq} ${TestClips.FRAME_SIZE} blurred=true kind=label ") }

        // The next still comes 6 seconds after this one at the earliest.
        Thread.sleep(QUIET_MS)
        assertEquals(1, labels().size)
        assertEquals("The blurred bars gave a code.", emptyList<DeviceToServer.BarcodeSeen>(), barcodes())
        assertEquals(StreamStatus.STREAMING, native.stream)
    }

    // The frames cannot read the blurred bars, so without this rule the region would ask for the same still again.
    @Test
    fun aStillWithACodeEndsTheStillsOfItsRegion() {
        startSession(TestClips.BLURRED)
        useStillImage(TestClips.BARCODE_IMAGE)

        val report = waitFor("barcode.seen goes out", LABEL_MS, ::state) { traffic.sent<DeviceToServer.BarcodeSeen>() }
        assertEquals(DeviceToServer.BarcodeSeen(TestClips.BARCODE_TEXT, BarcodeSource.BARCODE), report)
        // Longer than the 6 seconds between two stills.
        Thread.sleep(NEXT_STILL_MS)
        assertEquals(1, barcodes().size)
        assertEquals(emptyList<TrafficRecorder.Frame>(), labels())
    }

    @Test
    fun aStillRequestGivesALabelFrameWhenThePhoneReadsNoCode() {
        startSession()
        useStillImage(TestClips.SCENE_IMAGE)
        command("label")

        waitUntil("still.request arrives", STEP_MS, ::state) { traffic.fromServer.contains(ServerToDevice.StillRequest(StillPurpose.LABEL)) }
        val label = waitFor("a label frame goes out", LABEL_MS, ::state) { labels().firstOrNull() }
        assertEquals(TestClips.FRAME_SIZE, "${label.header.w}x${label.header.h}")
        awaitServerLog("the label frame") { it.startsWith("frame seq=${label.header.seq} ${TestClips.FRAME_SIZE} blurred=true kind=label ") }
        assertEquals(emptyList<DeviceToServer.BarcodeSeen>(), barcodes())
    }

    @Test
    fun aStillRequestGivesBarcodeSeenWhenThePhoneReadsTheStill() {
        startSession()
        useStillImage(TestClips.BARCODE_IMAGE)
        command("label")

        val report = waitFor("barcode.seen goes out", LABEL_MS, ::state) { traffic.sent<DeviceToServer.BarcodeSeen>() }
        assertEquals(DeviceToServer.BarcodeSeen(TestClips.BARCODE_TEXT, BarcodeSource.BARCODE), report)
        awaitServerLog("the code") { it == "barcode.seen ${TestClips.BARCODE_TEXT} source=barcode" }
        Thread.sleep(QUIET_MS)
        assertEquals("A still with a code that the phone read stays on the phone.", emptyList<TrafficRecorder.Frame>(), labels())
        assertEquals(1, barcodes().size)
    }

    @Test
    fun twoStillRequestsWithinOneSecondGiveOneStill() {
        startSession()
        useStillImage(TestClips.SCENE_IMAGE)
        command("label")
        command("label")
        waitUntil("both requests arrive", STEP_MS, ::state) { traffic.fromServer.count { it is ServerToDevice.StillRequest } == 2 }
        waitUntil("a label frame goes out", LABEL_MS, ::state) { labels().isNotEmpty() }
        Thread.sleep(QUIET_MS)
        assertEquals(1, labels().size)
    }

    // The sharp second look and the label still share the limit of `StillPolicy`.
    @Test
    fun aStillRequestRightAfterAnAmbiguousGlanceGivesNoSecondStill() {
        startSession()
        useStillImage(TestClips.SCENE_IMAGE)
        command("amb")
        waitUntil("the still of the second look goes out", LABEL_MS, ::state) { traffic.frames.any { it.header.kind == FrameKind.STILL } }
        command("label")
        waitUntil("still.request arrives", STEP_MS, ::state) { traffic.fromServer.any { it is ServerToDevice.StillRequest } }
        Thread.sleep(QUIET_MS)
        assertEquals(emptyList<TrafficRecorder.Frame>(), labels())
        assertEquals(1, traffic.frames.count { it.header.kind == FrameKind.STILL })
    }

    private fun useStillImage(assetName: String) {
        val image = assetUri(assetName)
        onMain { glasses.services.camera.setCapturedImage(image) }
    }

    private fun barcodes(): List<DeviceToServer.BarcodeSeen> = traffic.toServer.filterIsInstance<DeviceToServer.BarcodeSeen>()

    private fun labels(): List<TrafficRecorder.Frame> = traffic.frames.filter { it.header.kind == FrameKind.LABEL }

    private companion object {
        /** The first report needs the start of ML Kit and 2 equal reads. */
        const val CODE_MS = 10_000L
        const val REPEAT_WINDOW_MS = 3_300L

        /** A region asks for a still after 2.5 seconds. The capture and the read on the phone come after that. */
        const val LABEL_MS = 15_000L
        const val WATCH_MS = 6_000L
        const val QUIET_MS = 4_000L
        const val NEXT_STILL_MS = 8_000L
        const val MIN_JPEG_BYTES = 1000
    }
}
