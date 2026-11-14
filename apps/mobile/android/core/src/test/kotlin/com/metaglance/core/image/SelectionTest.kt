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

    @Test fun `picks the sharpest frame of each 300 ms window`() {
        val p = SharpestFramePicker<String>()
        assertNull(p.offer(0, "a", 3.0))
        assertNull(p.offer(143, "b", 9.0))
        assertNull(p.offer(286, "c", 5.0))
        assertEquals("b", p.offer(300, "d", 1.0))
        assertNull(p.offer(443, "e", 2.0))
        assertNull(p.offer(599, "f", 1.0))
        assertEquals("e", p.offer(600, "g", 0.5))
    }

    @Test fun `never picks a damaged frame, and a window with only damaged frames gives none`() {
        val p = SharpestFramePicker<String>()
        assertNull(p.offer(0, "a", 3.0))
        assertNull(p.offer(143, "b", 90.0, damaged = true))
        assertEquals("a", p.offer(300, "c", 50.0, damaged = true))
        assertNull(p.offer(443, "d", 70.0, damaged = true))
        // The window of c and d ends with no frame. The damaged frame e starts the next window, and f is its one good frame.
        assertNull(p.offer(600, "e", 60.0, damaged = true))
        assertNull(p.offer(743, "f", 0.5))
        assertEquals("f", p.offer(900, "g", 2.0))
        assertNull(p.offer(1043, "h", 1.0))
        assertEquals("g", p.offer(1200, "i", 1.0))
    }

    @Test fun `gives one line for each 3 seconds with a damaged frame`() {
        val log = DamageLog()
        assertNull(log.onFrame(0, damaged = false))
        assertNull(log.onFrame(1000, damaged = true))
        assertNull(log.onFrame(2000, damaged = true))
        assertNull(log.onFrame(2999, damaged = false))
        assertEquals("frames damaged=2 of 4", log.onFrame(3000, damaged = true))
        assertNull(log.onFrame(4500, damaged = false))
        assertEquals("frames damaged=1 of 2", log.onFrame(6100, damaged = false))
        assertEquals("frames damaged total=3 of 7", log.totalLine)
    }

    @Test fun `gives no line for 3 seconds with no damaged frame`() {
        val log = DamageLog()
        for (ms in 0L..9000L step 143) assertNull(log.onFrame(ms, damaged = false))
        assertEquals("frames damaged total=0 of 63", log.totalLine)
        // A stream that stood still for a long time starts a new 3 seconds.
        assertNull(log.onFrame(60_000, damaged = true))
        assertEquals("frames damaged=1 of 1", log.onFrame(63_000, damaged = false))
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
