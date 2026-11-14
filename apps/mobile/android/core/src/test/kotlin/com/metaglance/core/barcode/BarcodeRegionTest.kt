package com.metaglance.core.barcode

import com.metaglance.core.image.RectPx
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
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
}
