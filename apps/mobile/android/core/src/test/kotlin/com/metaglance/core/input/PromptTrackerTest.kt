package com.metaglance.core.input

import com.metaglance.core.contract.KioskRef
import com.metaglance.core.contract.ServerEvent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PromptTrackerTest {
    private val cleared = { id: String -> ServerEvent.GlanceCleared(id) }

    @Test fun `a prompt that still plays opens nothing`() {
        val t = PromptTracker()
        t.onPromptSpoken("p-0001")
        assertNull(t.headPrompt())
        assertNull(t.currentPromptId())
        assertNull(t.lastFinishedPromptId())
    }

    @Test fun `a finished prompt is the head prompt, with the time at which its line ended`() {
        val t = PromptTracker()
        t.onPromptSpoken("p-0001")
        t.onPromptDone("p-0001", 1000)
        assertEquals("p-0001", t.headPrompt()?.promptId)
        assertEquals(1000L, t.headPrompt()?.doneMs)
        assertEquals("p-0001", t.currentPromptId())
        assertEquals("p-0001", t.lastFinishedPromptId())
    }

    @Test fun `a line plays from its start to its end, and for 20 seconds at most`() {
        val t = PromptTracker()
        assertFalse(t.linePlaying(0))
        t.onPromptSpoken("p-0001", 1000)
        assertTrue(t.linePlaying(1000))
        assertTrue(t.linePlaying(20_999))
        assertFalse(t.linePlaying(21_000))
        t.onPromptDone("p-0001", 4000)
        assertFalse(t.linePlaying(4000))
        t.onPromptSpoken("p-0002", 5000)
        t.onEvent(cleared("p-0002"))
        assertFalse(t.linePlaying(5100))
    }

    @Test fun `a cleared prompt closes the window, and its ID stays the last finished one`() {
        val t = PromptTracker()
        t.onPromptSpoken("p-0001")
        t.onPromptDone("p-0001", 1000)
        t.onEvent(cleared("p-0009"))
        assertEquals("p-0001", t.currentPromptId())
        t.onEvent(cleared("p-0001"))
        assertNull(t.headPrompt())
        assertNull(t.currentPromptId())
        assertEquals("p-0001", t.lastFinishedPromptId())
    }

    @Test fun `a new prompt replaces the old one before it ends`() {
        val t = PromptTracker()
        t.onPromptSpoken("p-0001")
        t.onPromptDone("p-0001", 1000)
        t.onPromptSpoken("p-0002")
        assertNull(t.headPrompt())
        assertNull(t.currentPromptId())
        assertEquals("p-0001", t.lastFinishedPromptId())
        // A late report of the old prompt
        t.onPromptDone("p-0001", 2500)
        assertNull(t.currentPromptId())
        t.onPromptDone("p-0002", 3000)
        assertEquals("p-0002", t.headPrompt()?.promptId)
        assertEquals("p-0002", t.lastFinishedPromptId())
    }

    @Test fun `a repeat closes the window until the line ends again`() {
        val t = PromptTracker()
        t.onPromptSpoken("p-0001")
        t.onPromptDone("p-0001", 1000)
        t.onPromptSpoken("p-0001")
        assertNull(t.headPrompt())
        t.onPromptDone("p-0001", 12_000)
        assertEquals(12_000L, t.headPrompt()?.doneMs)
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
