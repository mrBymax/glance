package com.metaglance.core.input

import com.metaglance.core.contract.IntentKind
import com.metaglance.core.contract.MainYes

/** The volume keys of the phone as the yes and the no, for glasses with no Motion and no Inputs (spec section 16). */
object KeyInput {
    /**
     * Returns the answer of a volume key: up is a yes, and down is a no. Returns null when the key changes the
     * volume as usual: the keys are not the main yes, or no prompt is current.
     */
    fun intentFor(up: Boolean, mainYes: MainYes, currentPromptId: String?): IntentKind? {
        if (mainYes != MainYes.KEY || currentPromptId == null) return null
        return if (up) IntentKind.YES else IntentKind.NO
    }
}
