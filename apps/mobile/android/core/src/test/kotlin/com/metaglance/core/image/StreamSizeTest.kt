package com.metaglance.core.image

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class StreamSizeTest {
    @Test fun `gives one line for the first frame, and none for the frames of the same size`() {
        val size = StreamSize()
        assertEquals("stream size 720x1280", size.onFrame(720, 1280))
        assertNull(size.onFrame(720, 1280))
        assertNull(size.onFrame(720, 1280))
    }

    // The glasses lower the size of the stream when Bluetooth is slow: 720 x 1280, then 504 x 896.
    @Test fun `gives one line for each change of the size`() {
        val size = StreamSize()
        val lines = listOf(720 to 1280, 720 to 1280, 504 to 896, 504 to 896, 720 to 1280).mapNotNull { (width, height) -> size.onFrame(width, height) }
        assertEquals(listOf("stream size 720x1280", "stream size 504x896", "stream size 720x1280"), lines)
    }
}
