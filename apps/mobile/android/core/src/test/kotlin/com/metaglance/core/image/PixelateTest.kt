package com.metaglance.core.image

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class PixelateTest {
    /** An image in which each pixel holds its own index. */
    private fun image(w: Int, h: Int) = IntArray(w * h) { it }

    @Test fun `gives each block inside a box one color and leaves the rest`() {
        val px = image(100, 100)
        Pixelate.apply(px, 100, 100, listOf(RectPx(40, 40, 30, 30)))
        // The box grows by 6 pixels to 34..76, and its blocks have 8 pixels.
        assertEquals(px[35 * 100 + 35], px[36 * 100 + 36])
        assertEquals(38 * 100 + 38, px[34 * 100 + 34])
        assertNotEquals(px[41 * 100 + 41], px[42 * 100 + 42])
        assertEquals(0, px[0])
        assertEquals(33 * 100 + 33, px[33 * 100 + 33])
        assertEquals(76 * 100 + 76, px[76 * 100 + 76])
        assertEquals(99 * 100 + 99, px[99 * 100 + 99])
    }

    @Test fun `uses larger blocks for a larger box`() {
        val px = image(400, 400)
        Pixelate.apply(px, 400, 400, listOf(RectPx(100, 100, 120, 120)))
        // One sixth of 120 is 20. The grown box starts at 76.
        assertEquals(px[76 * 400 + 76], px[95 * 400 + 95])
        assertNotEquals(px[95 * 400 + 95], px[96 * 400 + 96])
    }

    @Test fun `clips a box at the image edge and accepts an empty list`() {
        val px = image(50, 50)
        Pixelate.apply(px, 50, 50, listOf(RectPx(40, 40, 30, 30), RectPx(-10, -10, 5, 5)))
        assertEquals(px[45 * 50 + 45], px[46 * 50 + 46])
        assertEquals(0, px[0])
        val same = image(50, 50)
        Pixelate.apply(same, 50, 50, emptyList())
        assertArrayEquals(image(50, 50), same)
    }
}
