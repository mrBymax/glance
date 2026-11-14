package com.metaglance.core.state

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GlassesWaitTest {
    @Test fun `the wait is over 5 minutes after its start`() {
        val wait = GlassesWait()
        wait.start(1000)
        assertFalse(wait.isOver(1000))
        assertFalse(wait.isOver(1000 + 299_999))
        assertTrue(wait.isOver(1000 + 300_000))
    }

    @Test fun `no wait is over before a start and after an end`() {
        val wait = GlassesWait(limitMs = 100)
        assertFalse(wait.isOver(1_000_000))
        wait.start(0)
        wait.end()
        assertFalse(wait.isOver(1_000_000))
    }

    // A session that started again and stopped again is a new wait, with the full time.
    @Test fun `a new start gives the full time again`() {
        val wait = GlassesWait(limitMs = 100)
        wait.start(0)
        wait.start(90)
        assertFalse(wait.isOver(150))
        assertTrue(wait.isOver(190))
    }
}
