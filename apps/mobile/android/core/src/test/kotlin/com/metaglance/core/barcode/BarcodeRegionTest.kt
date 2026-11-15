package com.metaglance.core.barcode

import com.metaglance.core.image.RectPx
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BarcodeRegionTest {
    @Test fun `the crop for the decoder adds the quiet zone on each side`() {
        assertEquals(RectPx(170, 480, 260, 120), BarcodeRegion.forDecode(RectPx(200, 500, 200, 80), 720, 1280))
    }

    @Test fun `the crop for the digits also reaches down by half of the height`() {
        assertEquals(RectPx(170, 480, 260, 160), BarcodeRegion.forDigits(RectPx(200, 500, 200, 80), 720, 1280))
    }

    @Test fun `a crop stays inside the frame`() {
        assertEquals(RectPx(0, 0, 230, 100), BarcodeRegion.forDecode(RectPx(0, 0, 200, 80), 720, 1280))
        assertEquals(RectPx(490, 1180, 230, 100), BarcodeRegion.forDigits(RectPx(520, 1200, 200, 80), 720, 1280))
    }

    @Test fun `a box with no part in the frame gives no crop`() {
        assertNull(BarcodeRegion.forDecode(RectPx(800, 100, 50, 50), 720, 1280))
        assertNull(BarcodeRegion.forDecode(RectPx(100, 100, 0, 50), 720, 1280))
    }

    @Test fun `a small crop scales 3 times, and a large one 2 times`() {
        assertEquals(3, BarcodeRegion.scale(RectPx(0, 0, 260, 120)))
        assertEquals(3, BarcodeRegion.scale(RectPx(0, 0, 320, 120)))
        assertEquals(2, BarcodeRegion.scale(RectPx(0, 0, 322, 120)))
        assertEquals(2, BarcodeRegion.scale(RectPx(0, 0, 720, 300)))
    }

    @Test fun `the largest region is the one to read`() {
        val small = RectPx(0, 0, 100, 50)
        val large = RectPx(300, 300, 200, 90)
        assertEquals(large, BarcodeRegion.largest(listOf(small, large)))
        assertNull(BarcodeRegion.largest(emptyList()))
    }

    @Test fun `a region with the form of a product barcode is linear, and a square one is not`() {
        assertTrue(BarcodeRegion.isLinear(RectPx(0, 0, 200, 90)))
        assertTrue(BarcodeRegion.isLinear(RectPx(0, 0, 90, 200)))
        assertTrue(BarcodeRegion.isLinear(RectPx(0, 0, 125, 100)))
        assertFalse(BarcodeRegion.isLinear(RectPx(0, 0, 480, 480)))
        assertFalse(BarcodeRegion.isLinear(RectPx(0, 0, 110, 100)))
        assertFalse(BarcodeRegion.isLinear(RectPx(0, 0, 0, 100)))
    }

    // Measured with the glasses on 2026-11-14, in a stream of 504 x 896. The first box is the text of a laptop screen.
    @Test fun `a region that is too large for a barcode that did not decode is no barcode`() {
        assertFalse(BarcodeRegion.fits(RectPx(left = 70, top = 211, width = 361, height = 242), 504, 896))
        assertTrue(BarcodeRegion.fits(RectPx(left = 241, top = 742, width = 199, height = 146), 504, 896))
    }

    @Test fun `a region fits up to half of the frame width and 30 percent of the frame height`() {
        assertTrue(BarcodeRegion.fits(RectPx(0, 0, 252, 268), 504, 896))
        assertFalse(BarcodeRegion.fits(RectPx(0, 0, 253, 100), 504, 896))
        assertFalse(BarcodeRegion.fits(RectPx(0, 0, 100, 269), 504, 896))
        assertTrue(BarcodeRegion.fits(RectPx(0, 0, 360, 384), 720, 1280))
        assertFalse(BarcodeRegion.fits(RectPx(0, 0, 361, 384), 720, 1280))
        assertTrue(BarcodeRegion.fits(RectPx(0, 0, 180, 192), 360, 640))
        assertFalse(BarcodeRegion.fits(RectPx(0, 0, 181, 192), 360, 640))
    }

    @Test fun `a crop holds the points inside it`() {
        val crop = RectPx(100, 200, 50, 20)
        assertTrue(BarcodeRegion.holds(crop, 100, 200))
        assertTrue(BarcodeRegion.holds(crop, 149, 219))
        assertFalse(BarcodeRegion.holds(crop, 150, 210))
        assertFalse(BarcodeRegion.holds(crop, 120, 199))
    }

    @Test fun `a crop with a side below 16 pixels is too small to read`() {
        assertNull(BarcodeRegion.forDecode(RectPx(100, 100, 40, 9), 720, 1280))
        assertNull(BarcodeRegion.forDigits(RectPx(100, 100, 11, 40), 720, 1280))
        assertEquals(RectPx(94, 97, 52, 18), BarcodeRegion.forDecode(RectPx(100, 100, 40, 12), 720, 1280))
    }
}
