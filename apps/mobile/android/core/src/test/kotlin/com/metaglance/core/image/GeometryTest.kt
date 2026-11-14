package com.metaglance.core.image

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class GeometryTest {
    @Test fun `crops the center for each stream size`() {
        assertEquals(RectPx(72, 192, 576, 896), FrameGeometry.centerCrop(720, 1280))
        assertEquals(RectPx(50, 134, 402, 626), FrameGeometry.centerCrop(504, 896))
        assertEquals(RectPx(36, 96, 288, 448), FrameGeometry.centerCrop(360, 640))
    }

    @Test fun `limits the long side to 768 and never makes a frame larger`() {
        assertEquals(494 to 768, FrameGeometry.outputSize(RectPx(72, 192, 576, 896)))
        assertEquals(402 to 626, FrameGeometry.outputSize(RectPx(50, 134, 402, 626)))
        assertEquals(432 to 768, FrameGeometry.outputSize(FrameGeometry.full(720, 1280)))
        assertEquals(768 to 432, FrameGeometry.outputSize(FrameGeometry.full(1280, 720)))
    }

    @Test fun `maps a face box into the cropped output and never makes it smaller`() {
        val crop = RectPx(72, 192, 576, 896)
        assertEquals(RectPx(0, 0, 86, 86), FrameGeometry.mapBox(RectPx(72, 192, 100, 100), crop, 494, 768))
        assertEquals(RectPx(0, 0, 67, 86), FrameGeometry.mapBox(RectPx(50, 192, 100, 100), crop, 494, 768))
        assertNull(FrameGeometry.mapBox(RectPx(0, 0, 50, 50), crop, 494, 768))
    }
}
