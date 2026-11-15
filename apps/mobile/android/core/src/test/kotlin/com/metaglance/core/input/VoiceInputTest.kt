package com.metaglance.core.input

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class VoiceInputTest {
    private fun final(text: String, confidence: Float? = 0.9f) = Transcript(text, true, confidence, "en_US")

    @Test fun `sends a final transcript as text`() {
        val out = VoiceInput.onTranscript(final("add"), muted = false)!!
        assertEquals("add", out.text)
        assertEquals(0.9, out.confidence, 0.001)
        assertEquals("en_US", out.locale)
    }

    @Test fun `ignores a result while a line plays, a partial result, and a blank text`() {
        assertNull(VoiceInput.onTranscript(final("add"), muted = true))
        assertNull(VoiceInput.onTranscript(Transcript("add", false, 0.9f, "en_US"), muted = false))
        assertNull(VoiceInput.onTranscript(final("  "), muted = false))
    }

    @Test fun `sends 0,5 when the glasses give no confidence, and und when they give no locale`() {
        val out = VoiceInput.onTranscript(Transcript("add", true, null, null), muted = false)!!
        assertEquals(0.5, out.confidence, 0.0)
        assertEquals("und", out.locale)
    }

    @Test fun `keeps the confidence inside the limits of the contract`() {
        assertEquals(1.0, VoiceInput.onTranscript(final("add", 1.2f), muted = false)!!.confidence, 0.0)
    }
}
