package com.metaglance.core.image

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SelectionTest {
    private fun checker(size: Int, square: Int) = ByteArray(size * size) { i ->
        (if (((i % size) / square + (i / size) / square) % 2 == 0) 16 else 235).toByte()
    }

    /** A 3 x 3 mean. A pixel outside the image has the value of the nearest pixel inside. */
    private fun boxBlur3(luma: ByteArray, size: Int) = ByteArray(size * size) { i ->
        var sum = 0
        for (dy in -1..1) {
            for (dx in -1..1) {
                val x = (i % size + dx).coerceIn(0, size - 1)
                val y = (i / size + dy).coerceIn(0, size - 1)
                sum += luma[y * size + x].toInt() and 0xFF
            }
        }
        (sum / 9).toByte()
    }

    @Test fun `a flat image has sharpness 0, and a blurred pattern is less sharp than the pattern`() {
        assertEquals(0.0, Sharpness.of(ByteArray(100 * 100) { 128.toByte() }, 100, 100), 0.0)
        val sharp = checker(96, 8)
        assertTrue(Sharpness.of(sharp, 96, 96) > Sharpness.of(boxBlur3(sharp, 96), 96, 96))
        // A tiny frame with its chroma bytes does not throw.
        Sharpness.of(ByteArray(6), 2, 2)
    }

    @Test fun `picks the sharpest frame of each 500 ms window`() {
        val p = SharpestFramePicker<String>()
        assertNull(p.offer(0, "a", 3.0))
        assertNull(p.offer(143, "b", 9.0))
        assertNull(p.offer(286, "c", 5.0))
        assertNull(p.offer(429, "d", 1.0))
        assertEquals("b", p.offer(572, "e", 2.0))
        assertNull(p.offer(715, "f", 1.0))
        assertEquals("e", p.offer(1072, "g", 0.5))
    }

    @Test fun `skips an upload for each reason of the spec`() {
        assertEquals(UploadSkip.SOCKET_DOWN, UploadGate.check(false, 0, true))
        assertEquals(UploadSkip.SOCKET_DOWN, UploadGate.check(false, 1, false))
        assertEquals(UploadSkip.STILL_SENDING, UploadGate.check(true, 1, true))
        assertEquals(UploadSkip.STILL_SENDING, UploadGate.check(true, 1, false))
        assertEquals(UploadSkip.NOT_WORN, UploadGate.check(true, 0, false))
        assertNull(UploadGate.check(true, 0, true))
        assertNull(UploadGate.check(true, 0, null))
    }
}
