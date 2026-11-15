package com.metaglance.core.state

import com.metaglance.core.contract.Cart
import com.metaglance.core.contract.CartChange
import com.metaglance.core.contract.CartChangeKind
import com.metaglance.core.contract.CartItem
import com.metaglance.core.contract.KioskRef
import com.metaglance.core.contract.Lang
import com.metaglance.core.contract.PendingKind
import com.metaglance.core.contract.Priority
import com.metaglance.core.contract.ProductRef
import com.metaglance.core.contract.ServerEvent
import com.metaglance.core.contract.StreamStatus
import com.metaglance.core.contract.Warning
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class HapticRulesTest {
    private val kiosk = KioskRef("kiosk-1", "Checkout 3", "Demo Market")
    private val product = ProductRef("oat-drink-1l", "Oat drink", "1 L", 189)
    private val item = CartItem("oat-drink-1l", "Oat drink", "1 L", 1, 189)

    private fun pending(warnings: List<Warning>) = ServerEvent.GlancePending("p-0001", PendingKind.NEW, product, warnings, 0)

    private fun updated(totalCents: Int, kind: CartChangeKind?) = ServerEvent.CartUpdated(Cart(listOf(item), totalCents), kind?.let { CartChange(it, "oat-drink-1l", "Oat drink") })

    private fun pattern(event: ServerEvent, totalBeforeCents: Int = 0, budgetCents: Int? = null) = HapticRules.forEvent(event, totalBeforeCents, budgetCents)

    @Test fun `maps each event to the pattern of the design`() {
        assertEquals(HapticPattern.PROMPT, pattern(pending(emptyList())))
        assertEquals(HapticPattern.WARNING, pattern(pending(listOf(Warning.AllergenDataMissing))))
        assertEquals(HapticPattern.PROMPT, pattern(ServerEvent.CheckoutOffered("p-0002", kiosk, 189, 1, needsBiometric = false)))
        assertEquals(HapticPattern.ADDED, pattern(updated(189, CartChangeKind.ADD)))
        assertEquals(HapticPattern.REMOVED, pattern(updated(0, CartChangeKind.REMOVE), totalBeforeCents = 189))
        assertNull(pattern(updated(189, null)))
        assertEquals(HapticPattern.WARNING, pattern(ServerEvent.BudgetExceeded(300, 378)))
        assertEquals(HapticPattern.PAID, pattern(ServerEvent.CheckoutPaid("o-1", 189, "2026-11-14T10:00:00Z", listOf(item), kiosk)))
        assertEquals(HapticPattern.ERROR, pattern(ServerEvent.CheckoutFailed("declined")))
        assertEquals(HapticPattern.ERROR, pattern(ServerEvent.Error("native.noDevice", "No glasses.")))
        assertNull(pattern(ServerEvent.Caption("c-1", "Oat drink.", Lang.EN, Priority.NORMAL, null)))
        assertNull(pattern(ServerEvent.GlanceCleared("p-0001")))
    }

    // The server sends `budget.exceeded` right after the `cart.updated` of that add, and one add gives one pattern.
    @Test fun `the add that crosses the budget gives no pattern of its own`() {
        assertNull(pattern(updated(378, CartChangeKind.ADD), totalBeforeCents = 189, budgetCents = 300))
        assertEquals(HapticPattern.ADDED, pattern(updated(250, CartChangeKind.ADD), totalBeforeCents = 189, budgetCents = 300))
        // The total is over the budget already, so no `budget.exceeded` follows this add.
        assertEquals(HapticPattern.ADDED, pattern(updated(378, CartChangeKind.ADD), totalBeforeCents = 301, budgetCents = 300))
        assertEquals(HapticPattern.ADDED, pattern(updated(378, CartChangeKind.ADD), totalBeforeCents = 300, budgetCents = null))
        assertEquals(HapticPattern.REMOVED, pattern(updated(0, CartChangeKind.REMOVE), totalBeforeCents = 378, budgetCents = 300))
    }

    @Test fun `signals a paused and a stopped camera one time`() {
        assertEquals(HapticPattern.CAMERA_PAUSED, HapticRules.forStream(StreamStatus.STREAMING, StreamStatus.PAUSED))
        assertNull(HapticRules.forStream(StreamStatus.PAUSED, StreamStatus.PAUSED))
        assertEquals(HapticPattern.CAMERA_OFF, HapticRules.forStream(StreamStatus.STREAMING, StreamStatus.STOPPED))
        assertEquals(HapticPattern.CAMERA_OFF, HapticRules.forStream(StreamStatus.PAUSED, StreamStatus.STOPPED))
        assertNull(HapticRules.forStream(StreamStatus.STOPPED, StreamStatus.STOPPED))
    }

    @Test fun `a camera that starts, and a start that fails, give no pattern`() {
        assertNull(HapticRules.forStream(StreamStatus.STOPPED, StreamStatus.STARTING))
        assertNull(HapticRules.forStream(StreamStatus.STARTING, StreamStatus.STREAMING))
        assertNull(HapticRules.forStream(StreamStatus.PAUSED, StreamStatus.STREAMING))
        assertNull(HapticRules.forStream(StreamStatus.STARTING, StreamStatus.STOPPED))
    }
}
