package com.metaglance.core.state

import com.metaglance.core.contract.CartChangeKind
import com.metaglance.core.contract.ServerEvent
import com.metaglance.core.contract.StreamStatus

/**
 * Selects the vibration for what happens in a session. The app decides it, not the page: the page does not run
 * while the screen is off.
 */
object HapticRules {
    /**
     * Returns the pattern for an event, or null. `totalBeforeCents` is the cart total before this event, and
     * `budgetCents` is the budget of the profile, or null for none.
     */
    fun forEvent(event: ServerEvent, totalBeforeCents: Int, budgetCents: Int?): HapticPattern? = when (event) {
        is ServerEvent.GlancePending -> if (event.warnings.isEmpty()) HapticPattern.PROMPT else HapticPattern.WARNING
        is ServerEvent.CheckoutOffered -> HapticPattern.PROMPT
        is ServerEvent.CartUpdated -> when (event.change?.kind) {
            null -> null
            CartChangeKind.REMOVE -> HapticPattern.REMOVED
            CartChangeKind.ADD -> if (crossesBudget(totalBeforeCents, event.cart.totalCents, budgetCents)) null else HapticPattern.ADDED
        }
        is ServerEvent.BudgetExceeded -> HapticPattern.WARNING
        is ServerEvent.CheckoutPaid -> HapticPattern.PAID
        is ServerEvent.CheckoutFailed, is ServerEvent.Error -> HapticPattern.ERROR
        else -> null
    }

    /**
     * Returns the pattern for a change of the camera stream, or null. The app makes a native state for each
     * change of a field, for example the battery level, so only a change of the stream gives a pattern.
     */
    fun forStream(before: StreamStatus, after: StreamStatus): HapticPattern? = when {
        before == after -> null
        after == StreamStatus.PAUSED -> HapticPattern.CAMERA_PAUSED
        after == StreamStatus.STOPPED && (before == StreamStatus.STREAMING || before == StreamStatus.PAUSED) -> HapticPattern.CAMERA_OFF
        else -> null
    }

    /**
     * True for the add that brings the total over the budget. The server sends `budget.exceeded` right after the
     * `cart.updated` of that add, and one add must give one pattern.
     */
    private fun crossesBudget(beforeCents: Int, afterCents: Int, budgetCents: Int?): Boolean = budgetCents != null && beforeCents <= budgetCents && afterCents > budgetCents
}
