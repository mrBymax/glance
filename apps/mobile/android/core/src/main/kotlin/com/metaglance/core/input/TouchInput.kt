package com.metaglance.core.input

import com.metaglance.core.contract.DeviceToServer
import com.metaglance.core.contract.IntentKind
import com.metaglance.core.contract.IntentSource

/** Turns a gesture on the touchpad of the glasses into an intent. */
object TouchInput {
    /**
     * A double tap is a yes for the last finished prompt. The server decides if it counts (rule R5).
     * A swipe in each direction asks for the last line again, and it names no prompt.
     */
    fun intentFor(event: TouchEvent, lastFinishedPromptId: String?): DeviceToServer.Intent = when (event) {
        TouchEvent.DOUBLE_TAP -> DeviceToServer.Intent(IntentKind.YES, IntentSource.TOUCH, lastFinishedPromptId)
        TouchEvent.SWIPE -> DeviceToServer.Intent(IntentKind.REPEAT, IntentSource.TOUCH)
    }
}
