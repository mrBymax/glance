package com.metaglance.core.image

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class I420Test {
    @Test fun `puts V and U in pairs after the Y plane`() {
        // 4 x 2 frame: 8 Y bytes, 2 U bytes, 2 V bytes
        val i420 = byteArrayOf(1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 20, 21)
        assertArrayEquals(byteArrayOf(1, 2, 3, 4, 5, 6, 7, 8, 20, 10, 21, 11), I420.toNv21(i420, 4, 2))
    }

    @Test fun `rejects a buffer that is shorter than the frame`() {
        assertThrows(IllegalArgumentException::class.java) { I420.toNv21(ByteArray(11), 4, 2) }
    }

    @Test fun `ignores bytes after the frame`() {
        assertEquals(12, I420.toNv21(ByteArray(20), 4, 2).size)
    }

    @Test fun `the luma crop is the gray of the Y plane in full range, scaled up`() {
        // 4 x 2 frame. The left half is black (16), and the right half is white (235).
        val black = 16.toByte()
        val white = 235.toByte()
        val i420 = byteArrayOf(black, black, white, white, black, black, white, white, 0, 0, 0, 0)
        val argb = I420.cropLumaToArgb(i420, 4, 2, RectPx(0, 0, 4, 2), 2)
        assertEquals(8 * 4, argb.size)
        assertEquals(0xFF000000.toInt(), argb[0])
        assertEquals(0xFFFFFFFF.toInt(), argb[7])
        // The pixels between both halves are a mix, so an edge has no steps.
        val grays = argb.take(8).map { it and 0xFF }
        assertEquals(grays, grays.sorted())
        assertTrue("grays: $grays", grays.any { it in 1..254 })
        assertEquals(argb[3] and 0xFF, (argb[3] shr 16) and 0xFF)
    }

    @Test fun `the luma crop reads the crop only`() {
        // 8 x 4 frame with a white right half.
        val i420 = ByteArray(I420.frameBytes(8, 4)) { if (it < 32 && it % 8 >= 4) 235.toByte() else 16.toByte() }
        val right = I420.cropLumaToArgb(i420, 8, 4, RectPx(4, 0, 4, 4), 3)
        assertEquals(12 * 12, right.size)
        assertTrue(right.all { it == 0xFFFFFFFF.toInt() })
    }

    @Test fun `the luma crop rejects a crop outside the frame and a scale below 1`() {
        val i420 = ByteArray(I420.frameBytes(8, 4))
        assertThrows(IllegalArgumentException::class.java) { I420.cropLumaToArgb(i420, 8, 4, RectPx(6, 0, 4, 4), 2) }
        assertThrows(IllegalArgumentException::class.java) { I420.cropLumaToArgb(i420, 8, 4, RectPx(0, 0, 4, 4), 0) }
    }
}
