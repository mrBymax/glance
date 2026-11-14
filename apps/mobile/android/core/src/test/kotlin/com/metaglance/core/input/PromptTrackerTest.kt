package com.metaglance.core.input

import com.metaglance.core.contract.KioskRef
import com.metaglance.core.contract.ServerEvent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PromptTrackerTest {
    private val cleared = { id: String -> ServerEvent.GlanceCleared(id) }

    @Test fun `a prompt that still plays opens nothing`() {
        val t = PromptTracker()
        t.onPromptSpoken("p-0001")
        assertNull(t.headPromptId(0, 8000))
        assertNull(t.currentPromptId())
        assertNull(t.lastFinishedPromptId())
    }

    @Test fun `the head window lasts 8 seconds after the prompt ends`() {
        val t = PromptTracker()
        t.onPromptSpoken("p-0001")
        t.onPromptDone("p-0001", 1000)
        assertEquals("p-0001", t.headPromptId(1000, 8000))
        assertEquals("p-0001", t.headPromptId(8999, 8000))
        assertNull(t.headPromptId(9000, 8000))
        assertEquals("p-0001", t.currentPromptId())
        assertEquals("p-0001", t.lastFinishedPromptId())
        assertEquals("p-0001", t.headPromptId(100_000, null))
        assertEquals("p-0001", t.headPromptId(15_999, 15_000))
    }

    @Test fun `a cleared prompt closes the window, and its ID stays the last finished one`() {
        val t = PromptTracker()
        t.onPromptSpoken("p-0001")
        t.onPromptDone("p-0001", 1000)
        t.onEvent(cleared("p-0009"))
        assertEquals("p-0001", t.currentPromptId())
        t.onEvent(cleared("p-0001"))
        assertNull(t.headPromptId(2000, 8000))
        assertNull(t.headPromptId(2000, null))
        assertNull(t.currentPromptId())
        assertEquals("p-0001", t.lastFinishedPromptId())
    }

    @Test fun `a new prompt replaces the old one before it ends`() {
        val t = PromptTracker()
        t.onPromptSpoken("p-0001")
        t.onPromptDone("p-0001", 1000)
        t.onPromptSpoken("p-0002")
        assertNull(t.headPromptId(2000, 8000))
        assertNull(t.currentPromptId())
        assertEquals("p-0001", t.lastFinishedPromptId())
        // A late report of the old prompt
        t.onPromptDone("p-0001", 2500)
        assertNull(t.currentPromptId())
        t.onPromptDone("p-0002", 3000)
        assertEquals("p-0002", t.headPromptId(3000, 8000))
        assertEquals("p-0002", t.lastFinishedPromptId())
    }

    @Test fun `a repeat closes the window until the line ends again`() {
        val t = PromptTracker()
        t.onPromptSpoken("p-0001")
        t.onPromptDone("p-0001", 1000)
        t.onPromptSpoken("p-0001")
        assertNull(t.headPromptId(2000, 8000))
        t.onPromptDone("p-0001", 12_000)
        assertEquals("p-0001", t.headPromptId(19_000, 8000))
    }

    @Test fun `the end of a checkout ends the prompt`() {
        val paid = ServerEvent.CheckoutPaid("ord-0001", 449, "2026-11-14T12:00:00.000Z", emptyList(), KioskRef("kiosk-1", "Checkout 3", "Demo Market"))
        for (event in listOf(ServerEvent.CheckoutCancelled, ServerEvent.CheckoutFailed("declined"), paid)) {
            val t = PromptTracker()
            t.onPromptSpoken("p-0001")
            t.onPromptDone("p-0001", 0)
            t.onEvent(event)
            assertNull(t.currentPromptId())
            assertEquals("p-0001", t.lastFinishedPromptId())
        }
    }

    @Test fun `an event that ends nothing keeps the prompt`() {
        val t = PromptTracker()
        t.onPromptSpoken("p-0001")
        t.onPromptDone("p-0001", 0)
        t.onEvent(ServerEvent.CheckoutSuspended)
        t.onEvent(ServerEvent.GlanceUnknown)
        assertEquals("p-0001", t.currentPromptId())
    }

    @Test fun `a reset forgets each prompt`() {
        val t = PromptTracker()
        t.onPromptSpoken("p-0001")
        t.onPromptDone("p-0001", 0)
        t.reset()
        assertNull(t.currentPromptId())
        assertNull(t.lastFinishedPromptId())
    }
}
