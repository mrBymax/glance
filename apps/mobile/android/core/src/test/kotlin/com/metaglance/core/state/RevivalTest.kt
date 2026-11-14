package com.metaglance.core.state

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RevivalTest {
    @Test fun `does not start a capability that never ran`() {
        assertFalse(Revival().onStopped(byApp = false))
    }

    @Test fun `starts a capability again at most 3 times`() {
        val r = Revival()
        r.onStarted()
        assertEquals(listOf(true, true, true, false), List(4) { r.onStopped(byApp = false) })
    }

    @Test fun `a new start resets the count`() {
        val r = Revival()
        r.onStarted()
        repeat(3) { r.onStopped(false) }
        r.onStarted()
        assertTrue(r.onStopped(false))
    }

    @Test fun `does not start again after a stop by the app`() {
        val r = Revival()
        r.onStarted()
        assertFalse(r.onStopped(byApp = true))
    }
}
