package com.metaglance.core.input

/** What the payment prompt of the phone reports. `ERROR` covers a cancel, a lockout, and a prompt that did not show. */
enum class PromptOutcome { SUCCEEDED, ERROR, ATTEMPT_FAILED }

/**
 * The answer of the phone to `biometric.request`: one `biometric.result` for each prompt that the shopper saw.
 * The server asks for it before a payment above 50 EUR.
 */
class PaymentConfirm {
    enum class Start {
        /** Show the prompt. Its outcomes go to [onOutcome]. */
        SHOW,

        /** A prompt is open. Its result answers this request too. */
        ALREADY_OPEN,

        /** The phone has no screen lock and no biometric. Send `ok: false` and the error event. */
        UNAVAILABLE
    }

    /** True from a request that shows the prompt to the outcome that ends the prompt. */
    var open = false
        private set

    /** `available` is false for a phone with no screen lock and no biometric. */
    fun onRequest(available: Boolean): Start = when {
        open -> Start.ALREADY_OPEN
        !available -> Start.UNAVAILABLE
        else -> {
            open = true
            Start.SHOW
        }
    }

    /**
     * Returns the `ok` of the result to send, or null to send nothing. A finger that does not match sends nothing,
     * because the prompt stays open. An outcome with no open prompt sends nothing.
     */
    fun onOutcome(outcome: PromptOutcome): Boolean? {
        if (!open || outcome == PromptOutcome.ATTEMPT_FAILED) return null
        open = false
        return outcome == PromptOutcome.SUCCEEDED
    }
}
