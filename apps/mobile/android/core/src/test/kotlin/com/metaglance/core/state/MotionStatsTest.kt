package com.metaglance.core.state

import org.junit.Assert.assertEquals
import org.junit.Test

class MotionStatsTest {
    private val stats = MotionStats()

    private fun ns(ms: Long) = ms * 1_000_000

    @Test fun `a steady flow has small gaps and no burst`() {
        for (i in 0L until 90) stats.onSample(ns(50_000 + i * 33), 1000 + i * 33)
        assertEquals("motion samples=90 new=90 arrivalGapMs=33 timeGapMs=33 burst=1 dropped=0", stats.take(3970))
    }

    @Test fun `a stall shows as an arrival gap that grows, also with no new sample`() {
        stats.onSample(ns(50_000), 1000)
        stats.take(1010)
        assertEquals("motion samples=1 new=0 arrivalGapMs=3000 timeGapMs=0 burst=0 dropped=0", stats.take(4000))
        assertEquals("motion samples=1 new=0 arrivalGapMs=6000 timeGapMs=0 burst=0 dropped=0", stats.take(7000))
    }

    @Test fun `samples that arrive together are a burst, and their own times show no gap`() {
        stats.onSample(ns(50_000), 1000)
        stats.take(1010)
        for (i in 1L..300) stats.onSample(ns(50_000 + i * 33), 11_000)
        assertEquals("motion samples=301 new=300 arrivalGapMs=10000 timeGapMs=33 burst=300 dropped=0", stats.take(11_010))
    }

    @Test fun `samples that the glasses or the SDK lost show as a gap in the sample times`() {
        stats.onSample(ns(50_000), 1000)
        stats.onSample(ns(50_033), 1033)
        stats.onSample(ns(56_000), 1066)
        assertEquals("motion samples=3 new=3 arrivalGapMs=33 timeGapMs=5967 burst=1 dropped=0", stats.take(1099))
    }

    @Test fun `counts the samples that the app dropped since the last line`() {
        stats.onDropped()
        stats.onDropped()
        assertEquals("motion samples=0 new=0 arrivalGapMs=0 timeGapMs=0 burst=0 dropped=2", stats.take(3000))
        assertEquals("motion samples=0 new=0 arrivalGapMs=0 timeGapMs=0 burst=0 dropped=0", stats.take(6000))
    }
}
