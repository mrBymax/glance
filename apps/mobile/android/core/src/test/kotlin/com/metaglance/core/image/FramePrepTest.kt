package com.metaglance.core.image

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
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
        assertNull(FramePrep.prepare(frame(720, 1280, 128), FaceResult.Failed))
    }

    @Test fun `keeps the full frame, with a long side of 768 pixels at most`() {
        fun size(w: Int, h: Int): Pair<Int, Int> {
            val prepared = FramePrep.prepare(frame(w, h, 128), FaceResult.NotRun)!!
            assertEquals(prepared.width * prepared.height, prepared.argb.size)
            return prepared.width to prepared.height
        }
        assertEquals(432 to 768, size(720, 1280))
        assertEquals(432 to 768, size(504, 896))
        assertEquals(360 to 640, size(360, 640))
    }

    @Test fun `keeps a product at the lower edge and at a side of the frame`() {
        // White rows at the lower edge, and white columns at the right side. The center crop of before cut both off.
        val f = frame(360, 640, 16).also {
            for (row in 600 until 640) for (col in 0 until 360) it.i420[row * 360 + col] = 235.toByte()
            for (row in 0 until 640) for (col in 340 until 360) it.i420[row * 360 + col] = 235.toByte()
        }
        val out = FramePrep.prepare(f, FaceResult.NotRun)!!
        assertEquals(360 to 640, out.width to out.height)
        assertTrue(out.argb[620 * 360 + 100] and 0xFF >= 254)
        assertTrue(out.argb[100 * 360 + 350] and 0xFF >= 254)
        assertEquals(0xFF000000.toInt(), out.argb[100 * 360 + 100])
    }

    @Test fun `marks a frame as blurred only when face detection ran`() {
        assertFalse(FramePrep.prepare(frame(360, 640, 128), FaceResult.NotRun)!!.blurred)
        assertTrue(FramePrep.prepare(frame(360, 640, 128), FaceResult.Found(emptyList()))!!.blurred)
    }

    /** A frame with no color, in which each luma byte differs from its neighbors. */
    private fun noiseFrame(w: Int, h: Int) = RawFrame(ByteArray(w * h * 3 / 2) { i -> (if (i < w * h) 16 + (i * 37 + i / w * 101) % 200 else 128).toByte() }, w, h, 0)

    @Test fun `pixelates a found face in the output`() {
        val f = noiseFrame(720, 1280)
        val out = FramePrep.prepare(f, FaceResult.Found(listOf(RectPx(300, 600, 120, 120))))!!
        val x = (300 * 432 / 720) + 20
        val y = (600 * 768 / 1280) + 20
        assertEquals(out.argb[y * out.width + x], out.argb[y * out.width + x + 1])
        assertTrue(out.blurred)
        assertEquals(432 to 768, out.width to out.height)
        // The same two pixels differ with no face, so the test frame is noise at that place.
        val plain = FramePrep.prepare(f, FaceResult.Found(emptyList()))!!
        assertNotEquals(plain.argb[y * plain.width + x], plain.argb[y * plain.width + x + 1])
    }

    @Test fun `a crop keeps the pixels of the frame, with no scale`() {
        val f = noiseFrame(720, 1280)
        val crop = RectPx(304, 366, 358, 716)
        val out = FramePrep.prepare(f, FaceResult.Found(emptyList()), crop)!!
        assertEquals(358 to 716, out.width to out.height)
        assertEquals(358 * 716, out.argb.size)
        assertTrue(out.blurred)
        // Each output pixel is the frame pixel at the same place of the crop.
        val whole = I420.cropScaleToArgb(f.i420, 720, 1280, FrameGeometry.full(720, 1280), 720, 1280)
        for ((x, y) in listOf(0 to 0, 357 to 0, 0 to 715, 357 to 715, 100 to 333)) {
            assertEquals("$x,$y", whole[(366 + y) * 720 + 304 + x], out.argb[y * 358 + x])
        }
    }

    @Test fun `a crop of a still that is larger than 1600 pixels is scaled to that`() {
        val out = FramePrep.prepare(frame(1200, 2000, 128), FaceResult.NotRun, RectPx(0, 0, 1000, 2000))!!
        assertEquals(800 to 1600, out.width to out.height)
    }

    @Test fun `pixelates the part of a face that is inside the crop`() {
        val f = noiseFrame(720, 1280)
        val crop = RectPx(304, 366, 358, 716)
        // The face starts left of the crop and ends inside it.
        val out = FramePrep.prepare(f, FaceResult.Found(listOf(RectPx(250, 400, 120, 120))), crop)!!
        assertEquals(out.argb[60 * 358 + 12], out.argb[60 * 358 + 13])
        val plain = FramePrep.prepare(f, FaceResult.Found(emptyList()), crop)!!
        assertNotEquals(plain.argb[60 * 358 + 12], plain.argb[60 * 358 + 13])
        // A place of the crop far from the face keeps its pixels.
        assertEquals(plain.argb[600 * 358 + 300], out.argb[600 * 358 + 300])
    }

    @Test fun `pixelates the edge of a crop beside a face, as the full frame does`() {
        val f = noiseFrame(720, 1280)
        val crop = RectPx(304, 366, 358, 716)
        // The face ends 4 pixels left of the crop. With its margin of 20 percent it reaches 20 pixels into the crop.
        val out = FramePrep.prepare(f, FaceResult.Found(listOf(RectPx(180, 400, 120, 120))), crop)!!
        assertEquals(out.argb[60 * 358 + 2], out.argb[60 * 358 + 3])
        val plain = FramePrep.prepare(f, FaceResult.Found(emptyList()), crop)!!
        assertNotEquals(plain.argb[60 * 358 + 2], plain.argb[60 * 358 + 3])
    }

    @Test fun `a face outside the crop changes nothing, and a failed face detection drops the crop`() {
        val f = noiseFrame(720, 1280)
        val crop = RectPx(304, 366, 358, 716)
        val out = FramePrep.prepare(f, FaceResult.Found(listOf(RectPx(0, 0, 100, 100))), crop)!!
        assertTrue(out.argb.contentEquals(FramePrep.prepare(f, FaceResult.Found(emptyList()), crop)!!.argb))
        assertNull(FramePrep.prepare(f, FaceResult.Failed, crop))
    }

    @Test fun `pixelates a face in the corner of the frame`() {
        // The center crop of before left this face out. The full frame shows it, so it must be pixelated.
        val f = noiseFrame(720, 1280)
        val out = FramePrep.prepare(f, FaceResult.Found(listOf(RectPx(0, 0, 100, 100))))!!
        assertEquals(out.argb[10 * out.width + 10], out.argb[10 * out.width + 11])
        val plain = FramePrep.prepare(f, FaceResult.NotRun)!!
        assertNotEquals(plain.argb[10 * plain.width + 10], plain.argb[10 * plain.width + 11])
    }
}
