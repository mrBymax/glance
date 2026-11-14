package com.metaglance.core.input

import com.metaglance.core.contract.MainYes
import org.junit.Assert.assertEquals
import org.junit.Test

class MainYesResolverTest {
    @Test fun `keeps an input that works and falls back in the order of spec section 16`() {
        fun r(wanted: MainYes, motion: Boolean, inputs: Boolean, speech: Boolean = false) = MainYesResolver.resolve(wanted, motion, inputs, speech)
        assertEquals(MainYes.HEAD, r(MainYes.HEAD, true, true))
        assertEquals(MainYes.TOUCH, r(MainYes.HEAD, false, true))
        assertEquals(MainYes.KEY, r(MainYes.HEAD, false, false))
        assertEquals(MainYes.TOUCH, r(MainYes.TOUCH, false, true))
        assertEquals(MainYes.KEY, r(MainYes.TOUCH, true, false))
        assertEquals(MainYes.HEAD, r(MainYes.VOICE, true, true))
        assertEquals(MainYes.TOUCH, r(MainYes.VOICE, false, true))
        assertEquals(MainYes.VOICE, r(MainYes.VOICE, true, true, speech = true))
        assertEquals(MainYes.PHONE, r(MainYes.PHONE, false, false))
        assertEquals(MainYes.KEY, r(MainYes.KEY, true, true))
    }
}
