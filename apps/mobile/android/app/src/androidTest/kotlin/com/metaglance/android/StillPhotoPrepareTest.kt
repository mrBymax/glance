package com.metaglance.android

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.metaglance.android.pipeline.StillPhoto
import com.metaglance.core.image.FaceResult
import com.metaglance.core.image.RectPx
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * `StillPhoto.prepare` with a photo of the size that the glasses give: decision 2 of Plan 2 Task 25.
 * The mock glasses give a still of 720 x 1280 pixels, so `StillPhotoTest` reaches no scale and no face.
 * This test gives the face box itself, because no test image holds a face.
 */
@RunWith(AndroidJUnit4::class)
class StillPhotoPrepareTest {
    @Test
    fun aLargePhotoIsCroppedScaledTo1440AndItsFaceIsPixelated() {
        val photo = stripes()
        var seen: Bitmap? = null
        val still = StillPhoto.prepare(photo) { bitmap ->
            seen = bitmap
            FaceResult.Found(listOf(FACE))
        }
        photo.recycle()

        assertTrue("Face detection did not get the full photo.", seen === photo)
        assertNotNull("The still was dropped.", still)
        val jpeg = checkNotNull(still).jpeg
        val image = BitmapFactory.decodeByteArray(jpeg, 0, jpeg.size)
        assertEquals("${OUT_WIDTH}x$OUT_HEIGHT", "${still.width}x${still.height}")
        assertEquals("${OUT_WIDTH}x$OUT_HEIGHT", "${image.width}x${image.height}")

        // The stripes are 6 pixels wide in the output, so a window of 17 pixels holds black and white.
        val plain = lightRange(image, PLAIN_LEFT, PLAIN_TOP)
        val hidden = lightRange(image, BLOCK_LEFT + BLOCK_MARGIN, BLOCK_TOP + BLOCK_MARGIN)
        image.recycle()
        assertTrue("The part with no face lost its stripes: range $plain.", plain > STRIPES_RANGE)
        assertTrue("The face is not one color in a block: range $hidden.", hidden < ONE_COLOR_RANGE)
    }

    @Test
    fun aPhotoWithNoResultOfFaceDetectionIsDropped() {
        val photo = Bitmap.createBitmap(SMALL_WIDTH, SMALL_HEIGHT, Bitmap.Config.ARGB_8888)
        assertNull(StillPhoto.prepare(photo) { FaceResult.Failed })
        assertNull(StillPhoto.prepare(photo) { FaceResult.NotRun })
        assertNotNull(StillPhoto.prepare(photo) { FaceResult.Found(emptyList()) })
        photo.recycle()
    }

    /** Black and white stripes, each 12 pixels wide. */
    private fun stripes(): Bitmap {
        val bitmap = Bitmap.createBitmap(PHOTO_WIDTH, PHOTO_HEIGHT, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.WHITE)
        val black = Paint().apply { color = Color.BLACK }
        for (left in 0 until PHOTO_WIDTH step 2 * STRIPE_PX) {
            canvas.drawRect(left.toFloat(), 0f, (left + STRIPE_PX).toFloat(), PHOTO_HEIGHT.toFloat(), black)
        }
        return bitmap
    }

    /** The difference between the lightest and the darkest pixel of a window, in the green channel. */
    private fun lightRange(image: Bitmap, left: Int, top: Int): Int {
        val pixels = IntArray(WINDOW_PX * WINDOW_PX)
        image.getPixels(pixels, 0, WINDOW_PX, left, top, WINDOW_PX, WINDOW_PX)
        val greens = pixels.map(Color::green)
        return greens.max() - greens.min()
    }

    private companion object {
        const val PHOTO_WIDTH = 3000
        const val PHOTO_HEIGHT = 4000
        const val STRIPE_PX = 12
        const val SMALL_WIDTH = 64
        const val SMALL_HEIGHT = 64

        /** The center crop of the photo is 2400 x 2800 pixels from (300, 600). Its long side becomes 1440. */
        const val OUT_WIDTH = 1234
        const val OUT_HEIGHT = 1440

        /** A face in the pixels of the photo. In the output it is 206 x 206 pixels from (514, 617). */
        val FACE = RectPx(1300, 1800, 400, 400)

        /**
         * `Pixelate` grows the box by 41 pixels to (473, 576) and uses blocks of 34 pixels.
         * This is the fourth block of the fourth row.
         */
        const val BLOCK_LEFT = 575
        const val BLOCK_TOP = 678

        /** The JPEG encoder mixes the colors at the edge of a block, so the window stays inside the block. */
        const val BLOCK_MARGIN = 9
        const val WINDOW_PX = 17
        const val PLAIN_LEFT = 100
        const val PLAIN_TOP = 100
        const val STRIPES_RANGE = 150
        const val ONE_COLOR_RANGE = 40
    }
}
