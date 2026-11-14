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
}
