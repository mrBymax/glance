package com.metaglance.core.input

import org.junit.Assert.assertEquals
import org.junit.Test

class GlassesClockTest {
    private fun ns(ms: Long) = ms * 1_000_000

    @Test fun `the sample with the shortest delay sets the offset`() {
        val clock = GlassesClock()
        // The clock of the glasses is 90 000 ms behind the clock of the phone. The first sample is 400 ms late.
        assertEquals(100_400, clock.phoneMs(ns(10_000), 100_400))
        assertEquals(100_433, clock.phoneMs(ns(10_033), 100_433))
        // This sample took 20 ms, so the two samples before it were taken earlier than the clock said.
        assertEquals(100_086, clock.phoneMs(ns(10_066), 100_086))
        // A sample that arrives 5 seconds late keeps the time at which the glasses took it.
        assertEquals(100_120, clock.phoneMs(ns(10_100), 105_000))
    }

    @Test fun `a sample time that goes back starts the offset again`() {
        val clock = GlassesClock()
        clock.phoneMs(ns(10_000), 100_020)
        // Mock glasses play each motion feed from the time 0.
        assertEquals(200_000, clock.phoneMs(ns(0), 200_000))
        assertEquals(200_033, clock.phoneMs(ns(33), 200_040))
    }
}
