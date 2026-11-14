package com.metaglance.core.image

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class StillPolicyTest {
    @Test fun `allows one capture at a time, and one each 5 seconds`() {
        val p = StillPolicy()
        assertTrue(p.tryStart(1000))
        assertFalse(p.tryStart(1500))
        p.onEnd()
        assertFalse(p.tryStart(5999))
        assertTrue(p.tryStart(6000))
    }

    @Test fun `a capture that runs longer than 5 seconds blocks the next one until it ends`() {
        val p = StillPolicy()
        assertTrue(p.tryStart(1000))
        assertFalse(p.tryStart(9000))
        p.onEnd()
        assertTrue(p.tryStart(9001))
    }

    @Test fun `the first capture can start at each time`() {
        assertTrue(StillPolicy().tryStart(0))
    }

    @Test fun `a still that a person asked for starts inside the 5 seconds, and not while a capture runs`() {
        val p = StillPolicy()
        assertTrue(p.tryStart(1000))
        assertFalse(p.tryStartNow(1500))
        p.onEnd()
        assertTrue(p.tryStartNow(1600))
        assertFalse(p.tryStartNow(1700))
        p.onEnd()
        // The next still of the app keeps its distance from this one.
        assertFalse(p.tryStart(6599))
        assertTrue(p.tryStart(6600))
    }
}
