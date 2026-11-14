package com.metaglance.core.image

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
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
}
