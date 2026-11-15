package com.metaglance.core.state

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class MotionWatchdogTest {
    private val dog = MotionWatchdog()
    private val lines = ArrayList<String>()
    private val restarts = ArrayList<Long>()

    /** One tick each 100 ms from `fromMs` to `toMs`, with frames that flow and no still. */
    private fun ticks(fromMs: Long, toMs: Long, framesFlow: Boolean = true, stillRuns: Boolean = false) {
        for (t in fromMs..toMs step 100) {
            val tick = dog.onTick(t, framesFlow, stillRuns)
            lines.addAll(tick.lines)
            if (tick.restart) restarts.add(t)
        }
    }

    /** One sample each 33 ms from `fromMs` up to `toMs`. */
    private fun samples(fromMs: Long, toMs: Long) {
        for (t in fromMs..toMs step 33) dog.onSample(t)?.let(lines::add)
    }

    @Test fun `is idle before Motion starts`() {
        ticks(0, 20_000)
        assertEquals(MotionFlow.IDLE, dog.flow)
        assertEquals(emptyList<String>(), lines)
        assertEquals(emptyList<Long>(), restarts)
    }

    @Test fun `a sample before the start of Motion is no stall`() {
        dog.onSample(5000)
        dog.onStarted(5010)
        samples(5033, 6000)
        assertEquals(MotionFlow.FLOWING, dog.flow)
        assertEquals(emptyList<String>(), lines)
    }

    @Test fun `stalls when Motion runs and no sample arrives for 500 ms`() {
        dog.onStarted(1000)
        ticks(1000, 1400)
        assertEquals(MotionFlow.FLOWING, dog.flow)
        assertNull(dog.stalledSinceMs)
        ticks(1500, 1500)
        assertEquals(MotionFlow.STALLED, dog.flow)
        assertEquals(1000L, dog.stalledSinceMs)
        assertEquals(listOf("motion stalled: no sample for 500 ms"), lines)
    }

    @Test fun `samples at 30 Hz keep the flow`() {
        dog.onStarted(0)
        for (t in 0L..5000 step 33) {
            dog.onSample(t)?.let(lines::add)
            if (t % 3 == 0L) ticks(t, t)
        }
        assertEquals(MotionFlow.FLOWING, dog.flow)
        assertEquals(emptyList<String>(), lines)
    }

    @Test fun `flows again after 10 samples with no gap, and logs the stall with its burst`() {
        dog.onStarted(0)
        samples(0, 2000)
        ticks(2100, 7100)
        assertEquals(MotionFlow.STALLED, dog.flow)
        assertEquals(1980L, dog.stalledSinceMs)
        // 9 samples arrive together, so the stall is not over.
        repeat(9) { dog.onSample(7200) }
        assertEquals(MotionFlow.STALLED, dog.flow)
        repeat(291) { dog.onSample(7200) }
        assertEquals(MotionFlow.FLOWING, dog.flow)
        assertNull(dog.stalledSinceMs)
        samples(7233, 8000)
        assertEquals(listOf("motion stalled: no sample for 520 ms", "motion stall 5220 ms, burst 300"), lines)
    }

    @Test fun `logs a burst that no sample follows`() {
        dog.onStarted(0)
        ticks(100, 3000, framesFlow = false)
        repeat(3) { dog.onSample(3050) }
        ticks(3100, 4000, framesFlow = false)
        assertEquals(MotionFlow.STALLED, dog.flow)
        assertEquals(listOf("motion stalled: no sample for 500 ms", "motion stall 3050 ms, burst 3"), lines)
    }

    @Test fun `a gap between the samples after a stall starts the count of 10 again`() {
        dog.onStarted(0)
        ticks(100, 1000)
        samples(1000, 1200)
        samples(2000, 2270)
        assertEquals(MotionFlow.STALLED, dog.flow)
        samples(2300, 2330)
        assertEquals(MotionFlow.FLOWING, dog.flow)
    }

    @Test fun `asks for a restart after 10 seconds with no sample, 3 times at most`() {
        dog.onStarted(0)
        ticks(100, 60_000)
        assertEquals(listOf(10_000L, 20_000L, 30_000L), restarts)
        assertEquals(
            listOf(
                "motion stalled: no sample for 500 ms",
                "motion restart 1 of 3: no sample for 10000 ms",
                "motion restart 2 of 3: no sample for 20000 ms",
                "motion restart 3 of 3: no sample for 30000 ms"
            ),
            lines
        )
    }

    @Test fun `asks for no restart while no video frame flows`() {
        dog.onStarted(0)
        ticks(100, 30_000, framesFlow = false)
        assertEquals(emptyList<Long>(), restarts)
        ticks(30_100, 30_100)
        assertEquals(listOf(30_100L), restarts)
    }

    @Test fun `asks for no restart during a still, and waits 10 seconds after it`() {
        dog.onStarted(0)
        ticks(100, 8000)
        ticks(8100, 12_000, stillRuns = true)
        ticks(12_100, 21_900)
        assertEquals(emptyList<Long>(), restarts)
        ticks(22_000, 22_000)
        assertEquals(listOf(22_000L), restarts)
    }

    @Test fun `stays stalled when Motion starts again after a restart`() {
        dog.onStarted(0)
        ticks(100, 10_000)
        dog.onStarted(10_050)
        assertEquals(MotionFlow.STALLED, dog.flow)
        assertEquals(0L, dog.stalledSinceMs)
    }

    @Test fun `a flow that returns allows 3 restarts again`() {
        dog.onStarted(0)
        ticks(100, 25_000)
        assertEquals(2, restarts.size)
        samples(25_000, 26_000)
        assertEquals(MotionFlow.FLOWING, dog.flow)
        ticks(26_100, 70_000)
        assertEquals(5, restarts.size)
    }

    // A restart that leaves Motion stopped ends in a new start. That start must not open 3 more restarts.
    @Test fun `a new start of Motion allows no new restart before samples flowed`() {
        dog.onStarted(0)
        ticks(100, 35_000)
        assertEquals(3, restarts.size)
        dog.onNotStarted()
        dog.onStarted(36_000)
        ticks(36_100, 90_000)
        assertEquals(3, restarts.size)
    }

    @Test fun `is idle when Motion does not run, for example in a paused session`() {
        dog.onStarted(0)
        ticks(100, 1000)
        dog.onNotStarted()
        assertEquals(MotionFlow.IDLE, dog.flow)
        assertNull(dog.stalledSinceMs)
        ticks(1100, 30_000)
        assertEquals(emptyList<Long>(), restarts)
        dog.onStarted(30_000)
        assertEquals(MotionFlow.FLOWING, dog.flow)
        assertFalse(dog.onTick(30_400, framesFlow = true, stillRuns = false).restart)
        assertTrue(dog.onTick(40_000, framesFlow = true, stillRuns = false).restart)
    }
}
