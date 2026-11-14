package com.metaglance.core.image

import org.junit.Assert.assertEquals
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
}
