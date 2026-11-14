package com.metaglance.core.kiosk

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class KioskDwellTest {
    private val k = listOf(SeenCode("K3X7", 9000))
    private val both = listOf(SeenCode("K3X7", 9000), SeenCode("ABCD", 40000))

    private fun KioskDwell.feed(range: IntProgression, codes: List<SeenCode>) = range.map { onFrame(it.toLong(), codes) }

    @Test fun `reports a code after 1500 ms in view and not before`() {
        val d = KioskDwell()
        assertTrue(d.feed(0..1400 step 100, k).all { it == null })
        assertEquals("K3X7", d.onFrame(1500, k))
    }

    @Test fun `reports at most one time each second`() {
        val d = KioskDwell()
        d.feed(0..1500 step 100, k)
        assertTrue(d.feed(1600..2400 step 100, k).all { it == null })
        assertEquals("K3X7", d.onFrame(2500, k))
    }

    @Test fun `keeps the dwell over a gap of 600 ms`() {
        val d = KioskDwell()
        d.feed(0..500 step 100, k)
        d.feed(600..1000 step 100, emptyList())
        d.feed(1100..1400 step 100, k)
        assertEquals("K3X7", d.onFrame(1500, k))
    }

    @Test fun `starts again after a longer gap`() {
        val d = KioskDwell()
        d.feed(0..500 step 100, k)
        d.feed(600..1100 step 100, emptyList())
        assertTrue(d.feed(1200..2600 step 100, k).all { it == null })
        assertEquals("K3X7", d.onFrame(2700, k))
    }

    @Test fun `reports the largest of two codes`() {
        val d = KioskDwell()
        d.feed(0..1400 step 100, both)
        assertEquals("ABCD", d.onFrame(1500, both))
    }

    @Test fun `starts a new dwell when a larger code takes over`() {
        val d = KioskDwell()
        d.feed(0..1000 step 100, k)
        assertTrue(d.feed(1100..2500 step 100, both).all { it == null })
        assertEquals("ABCD", d.onFrame(2600, both))
    }

    @Test fun `does not swap between two codes of similar size`() {
        val d = KioskDwell()
        val out = (0..1500 step 100).map { t ->
            val flip = (t / 100) % 2 == 0
            d.onFrame(t.toLong(), listOf(SeenCode("ABCD", if (flip) 9500 else 8500), SeenCode("K3X7", 9000)))
        }
        assertEquals("ABCD", out.last())
    }
}
