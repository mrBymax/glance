package com.metaglance.core.image

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class WaitingStillsTest {
    private val stills = WaitingStills()
    private val dropped = ArrayList<WaitingStill>()

    private fun next(nowMs: Long) = stills.next(nowMs, dropped::add)

    @Test fun `gives nothing when no still waits`() {
        assertNull(next(1000))
    }

    @Test fun `gives a still that waited one time`() {
        stills.add(WaitingStill.SECOND_LOOK, 1000)
        stills.add(WaitingStill.SECOND_LOOK, 2000)
        assertEquals(WaitingStill.SECOND_LOOK, next(3000))
        assertNull(next(3100))
        assertEquals(emptyList<WaitingStill>(), dropped)
    }

    // The second look shows what the shopper holds. After 5 seconds the shopper holds something else.
    @Test fun `drops a second look that waited longer than 5 seconds`() {
        stills.add(WaitingStill.SECOND_LOOK, 1000)
        assertNull(next(6001))
        assertEquals(listOf(WaitingStill.SECOND_LOOK), dropped)
        assertNull(next(6100))
        assertEquals(1, dropped.size)
    }

    @Test fun `a reference picture waits 30 seconds, and it comes before a second look`() {
        stills.add(WaitingStill.SECOND_LOOK, 1000)
        stills.add(WaitingStill.REFERENCE, 2000)
        assertEquals(WaitingStill.REFERENCE, next(3000))
        assertEquals(WaitingStill.SECOND_LOOK, next(3100))
        stills.add(WaitingStill.REFERENCE, 4000)
        assertEquals(WaitingStill.REFERENCE, next(34_000))
        stills.add(WaitingStill.REFERENCE, 40_000)
        assertNull(next(70_001))
        assertEquals(listOf(WaitingStill.REFERENCE), dropped)
    }
}
