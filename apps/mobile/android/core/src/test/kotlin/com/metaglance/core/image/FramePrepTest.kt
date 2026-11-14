package com.metaglance.core.image

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class FramePrepTest {
    /** A frame with the luma `y` and no color. */
    private fun frame(w: Int, h: Int, y: Int) = RawFrame(ByteArray(w * h * 3 / 2) { i -> (if (i < w * h) y else 128).toByte() }, w, h, 0)

    @Test fun `converts black, white, and gray`() {
        fun pixel(y: Int) = I420.cropScaleToArgb(frame(8, 8, y).i420, 8, 8, FrameGeometry.full(8, 8), 8, 8)[0]
        assertEquals(0xFF000000.toInt(), pixel(16))
        // Integer math can give 254.
        assertTrue(pixel(235) and 0xFF >= 254)
        val gray = pixel(128)
        assertEquals(gray shr 16 and 0xFF, gray and 0xFF)
        assertEquals(0xFF, gray ushr 24)
    }

    @Test fun `converts a red frame with the BT 709 values`() {
        // BT.709 limited range: pure red is Y 63, U 102, V 240.
        val red = frame(8, 8, 63).also {
            for (i in 64 until 80) it.i420[i] = 102
            for (i in 80 until 96) it.i420[i] = 240.toByte()
        }
        val pixel = I420.cropScaleToArgb(red.i420, 8, 8, FrameGeometry.full(8, 8), 8, 8)[0]
        assertTrue("red ${pixel shr 16 and 0xFF}", pixel shr 16 and 0xFF >= 250)
        assertTrue("green ${pixel shr 8 and 0xFF}", pixel shr 8 and 0xFF <= 5)
        assertTrue("blue ${pixel and 0xFF}", pixel and 0xFF <= 5)
    }

    @Test fun `keeps left and right`() {
        val f = frame(8, 4, 16).also {
            for (row in 0 until 4) for (col in 4 until 8) it.i420[row * 8 + col] = 235.toByte()
        }
        val out = I420.cropScaleToArgb(f.i420, 8, 4, FrameGeometry.full(8, 4), 8, 4)
        assertEquals(0xFF000000.toInt(), out[0])
        assertTrue(out[7] and 0xFF >= 254)
    }

    @Test fun `reads only the crop`() {
        val f = frame(8, 8, 16).also {
            for (row in 4 until 8) for (col in 4 until 8) it.i420[row * 8 + col] = 235.toByte()
        }
        val out = I420.cropScaleToArgb(f.i420, 8, 8, RectPx(4, 4, 4, 4), 2, 2)
        assertEquals(4, out.size)
        assertTrue(out.all { it and 0xFF >= 254 })
    }

    @Test fun `rejects a buffer that is shorter than the frame`() {
        assertThrows(IllegalArgumentException::class.java) {
            I420.cropScaleToArgb(ByteArray(95), 8, 8, FrameGeometry.full(8, 8), 8, 8)
        }
    }

    @Test fun `drops a frame when face detection failed`() {
        assertNull(FramePrep.prepare(frame(720, 1280, 128), FaceResult.Failed, crop = false))
    }

    @Test fun `follows the size of each frame`() {
        fun size(w: Int, h: Int, crop: Boolean): Pair<Int, Int> {
            val prepared = FramePrep.prepare(frame(w, h, 128), FaceResult.NotRun, crop)!!
            assertEquals(prepared.width * prepared.height, prepared.argb.size)
            return prepared.width to prepared.height
        }
        assertEquals(432 to 768, size(720, 1280, false))
        assertEquals(432 to 768, size(504, 896, false))
        assertEquals(360 to 640, size(360, 640, false))
        assertEquals(494 to 768, size(720, 1280, true))
    }

    @Test fun `marks a frame as blurred only when face detection ran`() {
        assertFalse(FramePrep.prepare(frame(360, 640, 128), FaceResult.NotRun, false)!!.blurred)
        assertTrue(FramePrep.prepare(frame(360, 640, 128), FaceResult.Found(emptyList()), false)!!.blurred)
    }
}
