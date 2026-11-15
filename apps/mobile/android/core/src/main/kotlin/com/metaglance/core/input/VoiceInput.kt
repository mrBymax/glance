package com.metaglance.core.input

import com.metaglance.core.contract.DeviceToServer

/**
 * Turns a speech result of the glasses into a `speech.final` message. The app maps no word to an intent:
 * the server owns the command words.
 */
object VoiceInput {
    /**
     * Returns the message for a final transcript with text. Returns null for each other result, and for each
     * result while `muted` is true: the microphone of the glasses hears each line that the app plays.
     */
    fun onTranscript(t: Transcript, muted: Boolean): DeviceToServer.SpeechFinal? {
        if (muted || !t.isFinal || t.text.isBlank()) return null
        val confidence = t.confidence?.takeIf { !it.isNaN() }?.toDouble()?.coerceIn(0.0, 1.0) ?: NO_CONFIDENCE
        return DeviceToServer.SpeechFinal(t.text, confidence, t.locale ?: UNKNOWN_LOCALE)
    }

    /** The contract has no value for "not available", and the server drops a result below this value. */
    private const val NO_CONFIDENCE = 0.5

    /** The language tag of BCP 47 for a language that is not known. */
    private const val UNKNOWN_LOCALE = "und"
}
