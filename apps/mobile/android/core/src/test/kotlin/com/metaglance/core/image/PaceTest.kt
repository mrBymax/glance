package com.metaglance.core.image

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PaceTest {
    @Test fun `allows three runs each second for a pace of 333 ms`() {
        val pace = Pace(333)
        assertEquals(listOf(0, 350, 700, 1050), (0..1300 step 70).filter { pace.tryRun(it.toLong()) })
    }

    @Test fun `the first run can start at each time`() {
        assertTrue(Pace(333).tryRun(5))
    }
}
