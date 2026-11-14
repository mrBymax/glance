package com.metaglance.core.input

import com.metaglance.core.contract.KioskRef
import com.metaglance.core.contract.PendingKind
import com.metaglance.core.contract.ProductRef
import com.metaglance.core.contract.ServerEvent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PromptTrackerTest {
    private val cleared = { id: String -> ServerEvent.GlanceCleared(id) }
    private val kiosk = KioskRef("kiosk-1", "Checkout 3", "Demo Market")

    private fun pending(id: String) = ServerEvent.GlancePending(id, PendingKind.NEW, ProductRef("oat-drink-1l", "Oat drink", "1 l", 149), emptyList(), 0)

    /** A product prompt whose line arrived and started to play at `startMs`. */
    private fun productPrompt(id: String, startMs: Long) = PromptTracker().also {
        it.onEvent(pending(id))
        it.onPromptSpoken(id, startMs)
        it.onLineStart(id, startMs)
    }

    @Test fun `a product prompt is the head prompt from the start of its line, and opens 300 ms later`() {
        val t = productPrompt("p-0001", 1000)
        assertEquals("p-0001", t.headPrompt()?.promptId)
        assertEquals(1300L, t.headPrompt()?.openMs)
        // The line ends 20 seconds after its start at the latest.
        assertEquals(21_000L, t.headPrompt()?.doneMs)
        assertNull(t.currentPromptId())
        t.onPromptDone("p-0001", 7000)
        assertEquals(1300L, t.headPrompt()?.openMs)
        assertEquals(7000L, t.headPrompt()?.doneMs)
        assertEquals(1000L, t.lineStartMs("p-0001"))
        assertNull(t.lineStartMs("p-0002"))
    }

    @Test fun `a prompt with a line shorter than 300 ms opens at the end of the line`() {
        val t = productPrompt("p-0001", 1000)
        t.onPromptDone("p-0001", 1200)
        assertEquals(1200L, t.headPrompt()?.openMs)
    }

    // The shopper must not wait for the end of a line to pay or to cancel.
    @Test fun `a pay prompt opens 300 ms after the start of its line`() {
        val t = PromptTracker()
        t.onEvent(ServerEvent.CheckoutOffered("p-0002", kiosk, 449, 3, false))
        t.onPromptSpoken("p-0002", 1000)
        t.onLineStart("p-0002", 1000)
        assertEquals("p-0002", t.headPrompt()?.promptId)
        assertEquals(1300L, t.headPrompt()?.openMs)
        assertEquals(21_000L, t.headPrompt()?.doneMs)
        t.onPromptDone("p-0002", 6000)
        assertEquals(1300L, t.headPrompt()?.openMs)
        assertEquals(6000L, t.headPrompt()?.doneMs)
    }

    @Test fun `a prompt with no event that names its kind opens 300 ms after the start of its line`() {
        val t = PromptTracker()
        t.onPromptSpoken("p-0003", 1000)
        t.onLineStart("p-0003", 1000)
        assertEquals(1300L, t.headPrompt()?.openMs)
    }

    // A pay prompt that follows a cart change waits behind the line "Added" or "Removed", which has no prompt.
    @Test fun `a prompt whose line waits behind another line opens 300 ms after it arrived`() {
        val t = PromptTracker()
        t.onEvent(ServerEvent.CheckoutOffered("p-0002", kiosk, 449, 3, false))
        t.onPromptSpoken("p-0002", 1000)
        assertEquals(1300L, t.headPrompt()?.openMs)
        assertEquals(21_000L, t.headPrompt()?.doneMs)
        t.onLineStart("p-0009", 1500)
        assertEquals(21_000L, t.headPrompt()?.doneMs)
        // The start of the line keeps the time at which the window opened, so the window stays the same one.
        t.onLineStart("p-0002", 3000)
        assertEquals(1300L, t.headPrompt()?.openMs)
        assertEquals(23_000L, t.headPrompt()?.doneMs)
    }

    // With the sound off no line plays, and the queue reports the prompt at once.
    @Test fun `a prompt with no line opens when it is finished`() {
        val t = PromptTracker()
        t.onEvent(pending("p-0001"))
        t.onPromptSpoken("p-0001", 1000)
        t.onPromptDone("p-0001", 1000)
        assertEquals(1000L, t.headPrompt()?.openMs)
    }

    @Test fun `a repeat of a prompt opens again 300 ms after its line arrived again`() {
        val t = productPrompt("p-0001", 1000)
        t.onPromptDone("p-0001", 7000)
        t.onPromptSpoken("p-0001", 9000)
        assertEquals(9300L, t.headPrompt()?.openMs)
        t.onLineStart("p-0001", 9000)
        assertEquals(9300L, t.headPrompt()?.openMs)
        assertEquals(29_000L, t.headPrompt()?.doneMs)
    }

    @Test fun `a cleared product prompt opens nothing while its line plays`() {
        val t = productPrompt("p-0001", 1000)
        t.onEvent(cleared("p-0001"))
        assertNull(t.headPrompt())
    }

    // The app gives the time of each line. With no time, the window opens when the line ended.
    @Test fun `a prompt whose line has no arrival time opens nothing while it plays`() {
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
        val paid = ServerEvent.CheckoutPaid("ord-0001", 449, "2026-11-14T12:00:00.000Z", emptyList(), kiosk)
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
