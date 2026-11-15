package com.metaglance.core.input

import com.metaglance.core.contract.DeviceToServer
import com.metaglance.core.contract.IntentKind
import com.metaglance.core.contract.IntentSource
import org.junit.Assert.assertEquals
import org.junit.Test

class TouchInputTest {
    @Test fun `a double tap is a yes for the last finished prompt, and a swipe repeats`() {
        assertEquals(DeviceToServer.Intent(IntentKind.YES, IntentSource.TOUCH, "p-0001"), TouchInput.intentFor(TouchEvent.DOUBLE_TAP, "p-0001"))
        assertEquals(DeviceToServer.Intent(IntentKind.YES, IntentSource.TOUCH), TouchInput.intentFor(TouchEvent.DOUBLE_TAP, null))
        assertEquals(DeviceToServer.Intent(IntentKind.REPEAT, IntentSource.TOUCH), TouchInput.intentFor(TouchEvent.SWIPE, "p-0001"))
    }
}
