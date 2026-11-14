package com.metaglance.core.input

import com.metaglance.core.contract.IntentKind
import com.metaglance.core.contract.MainYes
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class KeyInputTest {
    @Test fun `the volume keys answer a current prompt only when they are the main yes`() {
        assertEquals(IntentKind.YES, KeyInput.intentFor(up = true, MainYes.KEY, "p-0001"))
        assertEquals(IntentKind.NO, KeyInput.intentFor(up = false, MainYes.KEY, "p-0001"))
        assertNull(KeyInput.intentFor(up = true, MainYes.KEY, null))
        assertNull(KeyInput.intentFor(up = true, MainYes.HEAD, "p-0001"))
    }

    @Test fun `each main yes that is not the key leaves both keys to the volume`() {
        for (mainYes in MainYes.entries.filter { it != MainYes.KEY }) {
            assertNull(KeyInput.intentFor(up = true, mainYes, "p-0001"))
            assertNull(KeyInput.intentFor(up = false, mainYes, "p-0001"))
        }
    }
}
