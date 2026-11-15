package com.metaglance.core.input

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PaymentConfirmTest {
    @Test fun `a request shows the prompt, and a success answers true one time`() {
        val confirm = PaymentConfirm()
        assertEquals(PaymentConfirm.Start.SHOW, confirm.onRequest(available = true))
        assertTrue(confirm.open)
        assertEquals(true, confirm.onOutcome(PromptOutcome.SUCCEEDED))
        assertFalse(confirm.open)
        assertNull(confirm.onOutcome(PromptOutcome.SUCCEEDED))
    }

    @Test fun `an error answers false, and this covers a cancel`() {
        val confirm = PaymentConfirm()
        confirm.onRequest(available = true)
        assertEquals(false, confirm.onOutcome(PromptOutcome.ERROR))
        assertNull(confirm.onOutcome(PromptOutcome.ERROR))
    }

    @Test fun `a finger that does not match answers nothing, because the prompt stays open`() {
        val confirm = PaymentConfirm()
        confirm.onRequest(available = true)
        assertNull(confirm.onOutcome(PromptOutcome.ATTEMPT_FAILED))
        assertTrue(confirm.open)
        assertEquals(true, confirm.onOutcome(PromptOutcome.SUCCEEDED))
    }

    @Test fun `a phone with no screen lock shows no prompt`() {
        val confirm = PaymentConfirm()
        assertEquals(PaymentConfirm.Start.UNAVAILABLE, confirm.onRequest(available = false))
        assertFalse(confirm.open)
        assertNull(confirm.onOutcome(PromptOutcome.SUCCEEDED))
    }

    @Test fun `a second request keeps the open prompt, and its result answers one time`() {
        val confirm = PaymentConfirm()
        confirm.onRequest(available = true)
        assertEquals(PaymentConfirm.Start.ALREADY_OPEN, confirm.onRequest(available = true))
        assertEquals(true, confirm.onOutcome(PromptOutcome.SUCCEEDED))
        assertNull(confirm.onOutcome(PromptOutcome.SUCCEEDED))
    }

    @Test fun `an outcome with no request answers nothing`() {
        val confirm = PaymentConfirm()
        assertNull(confirm.onOutcome(PromptOutcome.SUCCEEDED))
        assertNull(confirm.onOutcome(PromptOutcome.ERROR))
    }

    @Test fun `each request after an answer shows a new prompt`() {
        val confirm = PaymentConfirm()
        confirm.onRequest(available = true)
        confirm.onOutcome(PromptOutcome.ERROR)
        assertEquals(PaymentConfirm.Start.SHOW, confirm.onRequest(available = true))
        assertEquals(true, confirm.onOutcome(PromptOutcome.SUCCEEDED))
    }
}
