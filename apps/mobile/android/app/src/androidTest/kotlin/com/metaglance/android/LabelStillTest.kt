package com.metaglance.android

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.google.mlkit.vision.barcode.common.Barcode
import com.metaglance.android.pipeline.CodeHit
import com.metaglance.android.pipeline.CodeScanner
import com.metaglance.android.pipeline.DigitReader
import com.metaglance.android.pipeline.LabelOutcome
import com.metaglance.android.pipeline.LabelStill
import com.metaglance.android.support.TestClips
import com.metaglance.core.barcode.CodeRead
import com.metaglance.core.barcode.TextElement
import com.metaglance.core.contract.BarcodeSource
import com.metaglance.core.image.FaceResult
import com.metaglance.core.image.RectPx
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * `LabelStill.read` with no glasses and no server: what the phone does with the still photo of a barcode.
 * Two tests use ML Kit on images of the test APK. The other tests give the hits and the words themselves,
 * because no test image has the size of a photo of the glasses.
 */
@RunWith(AndroidJUnit4::class)
class LabelStillTest {
    private val noFaces: (Bitmap) -> FaceResult = { FaceResult.Found(emptyList()) }
    private val noHits: (Bitmap) -> List<CodeHit> = { emptyList() }
    private val noWords: (Bitmap) -> List<TextElement> = { emptyList() }

    @Test
    fun thePhoneReadsTheBarcodeOfAStillWithMlKit() {
        val outcome = readWithMlKit(TestClips.BARCODE_IMAGE)
        assertEquals(CodeRead(TestClips.BARCODE_TEXT, BarcodeSource.BARCODE), (outcome as? LabelOutcome.Code)?.read)
    }

    @Test
    fun aStillWithNoCodeBecomesAFrameWithNoCrop() {
        val outcome = readWithMlKit(TestClips.SCENE_IMAGE)
        val still = checkNotNull((outcome as? LabelOutcome.Upload)?.still) { "The outcome is $outcome." }
        assertEquals(TestClips.FRAME_SIZE, "${still.width}x${still.height}")
        val image = BitmapFactory.decodeByteArray(still.jpeg, 0, still.jpeg.size)
        assertEquals(TestClips.FRAME_SIZE, "${image.width}x${image.height}")
        image.recycle()
    }

    @Test
    fun aLargeStillIsScaledTo1600WithNoCrop() {
        val photo = Bitmap.createBitmap(PHOTO_WIDTH, PHOTO_HEIGHT, Bitmap.Config.ARGB_8888)
        val outcome = LabelStill.read(photo, noHits, noWords, noFaces)
        photo.recycle()
        val still = checkNotNull((outcome as? LabelOutcome.Upload)?.still) { "The outcome is $outcome." }
        assertEquals("1200x1600", "${still.width}x${still.height}")
    }

    @Test
    fun aStillWithNoResultOfFaceDetectionIsDropped() {
        val photo = Bitmap.createBitmap(SMALL, SMALL, Bitmap.Config.ARGB_8888)
        assertTrue(LabelStill.read(photo, noHits, noWords) { FaceResult.Failed } is LabelOutcome.Dropped)
        assertTrue(LabelStill.read(photo, noHits, noWords) { FaceResult.NotRun } is LabelOutcome.Dropped)
        photo.recycle()
    }

    @Test
    fun aCodeOfTheStillNeedsNoFaceDetection() {
        val photo = Bitmap.createBitmap(SMALL, SMALL, Bitmap.Config.ARGB_8888)
        val decoded: (Bitmap) -> List<CodeHit> = { listOf(CodeHit(PASTA, Barcode.FORMAT_EAN_13, RectPx(0, 0, 40, 20))) }
        val outcome = LabelStill.read(photo, decoded, noWords) { FaceResult.Failed }
        photo.recycle()
        assertEquals(CodeRead(PASTA, BarcodeSource.BARCODE), (outcome as? LabelOutcome.Code)?.read)
    }

    @Test
    fun theDigitsUnderARegionCountAndOtherDigitsOfThePhotoDoNot() {
        val photo = Bitmap.createBitmap(PHOTO_HEIGHT, PHOTO_WIDTH, Bitmap.Config.ARGB_8888)
        val region: (Bitmap) -> List<CodeHit> = { listOf(CodeHit(null, Barcode.FORMAT_UNKNOWN, RectPx(1000, 1000, 600, 300))) }
        val words: (Bitmap) -> List<TextElement> = {
            listOf(
                TextElement("8", RectPx(960, 1320, 30, 50)),
                TextElement("076809", RectPx(1050, 1320, 240, 50)),
                TextElement("513753", RectPx(1330, 1320, 240, 50)),
                // The code of another product at the edge of the photo.
                TextElement("4006381333931", RectPx(100, 100, 500, 50))
            )
        }
        val outcome = LabelStill.read(photo, region, words, noFaces)
        photo.recycle()
        assertEquals(CodeRead(PASTA, BarcodeSource.OCR), (outcome as? LabelOutcome.Code)?.read)
    }

    @Test
    fun withNoRegionOnly12Or13DigitsCount() {
        val photo = Bitmap.createBitmap(SMALL, SMALL, Bitmap.Config.ARGB_8888)
        val date: (Bitmap) -> List<TextElement> = { listOf(TextElement("73513537", RectPx(10, 10, 30, 8))) }
        assertTrue(LabelStill.read(photo, noHits, date, noFaces) is LabelOutcome.Upload)
        val code: (Bitmap) -> List<TextElement> = { listOf(TextElement(PASTA, RectPx(10, 10, 40, 8))) }
        assertEquals(CodeRead(PASTA, BarcodeSource.OCR), (LabelStill.read(photo, noHits, code, noFaces) as? LabelOutcome.Code)?.read)
        // Two codes in one photo with no region: the phone cannot know which one the shopper holds up.
        val two: (Bitmap) -> List<TextElement> = { listOf(TextElement(PASTA, RectPx(10, 10, 40, 8)), TextElement("4006381333931", RectPx(10, 40, 40, 8))) }
        assertTrue(LabelStill.read(photo, noHits, two, noFaces) is LabelOutcome.Upload)
        photo.recycle()
    }

    private fun readWithMlKit(assetName: String): LabelOutcome {
        val photo = InstrumentationRegistry.getInstrumentation().context.assets.open(assetName).use(BitmapFactory::decodeStream)
        val scanner = CodeScanner()
        val digits = DigitReader()
        try {
            return LabelStill.read(photo, { scanner.scan(it) }, { digits.read(it) }, noFaces)
        } finally {
            scanner.close()
            digits.close()
            photo.recycle()
        }
    }

    private companion object {
        const val PASTA = "8076809513753"
        const val PHOTO_WIDTH = 3000
        const val PHOTO_HEIGHT = 4000
        const val SMALL = 64
    }
}
