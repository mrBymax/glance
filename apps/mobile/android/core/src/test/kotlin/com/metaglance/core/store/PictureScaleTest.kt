package com.metaglance.core.store

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PictureScaleTest {
    @Test fun `brings the long side to 1600 and keeps the shape`() {
        assertEquals(1600 to 1200, PictureScale.fit(4000, 3000))
        assertEquals(1200 to 1600, PictureScale.fit(3000, 4000))
        assertEquals(1600 to 900, PictureScale.fit(4032, 2268))
        assertEquals(1600 to 1600, PictureScale.fit(5000, 5000))
    }

    @Test fun `a picture at the limit or below keeps its size`() {
        assertEquals(1600 to 1200, PictureScale.fit(1600, 1200))
        assertEquals(800 to 600, PictureScale.fit(800, 600))
        assertEquals(1 to 1, PictureScale.fit(1, 1))
    }

    @Test fun `a very thin picture keeps one pixel`() {
        assertEquals(1600 to 1, PictureScale.fit(16000, 2))
    }

    @Test fun `the decoder never reads less than the long side that goes out`() {
        assertEquals(1, PictureScale.sampleSize(1600, 1200))
        assertEquals(1, PictureScale.sampleSize(3199, 2000))
        assertEquals(2, PictureScale.sampleSize(3200, 2400))
        assertEquals(2, PictureScale.sampleSize(4000, 3000))
        assertEquals(4, PictureScale.sampleSize(3000, 8000))
        assertEquals(1, PictureScale.sampleSize(10, 10))
        for (long in listOf(1601, 3264, 4032, 8000, 12000)) {
            val sample = PictureScale.sampleSize(long, long / 2)
            assertTrue("long=$long sample=$sample", long / sample >= PictureScale.MAX_LONG_SIDE)
        }
    }
}
