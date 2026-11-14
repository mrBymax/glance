package com.metaglance.core.input

import com.metaglance.core.contract.MainYes

object MainYesResolver {
    /**
     * Returns the main yes input that works on these glasses (spec section 16).
     * `HEAD` needs Motion, `TOUCH` needs Inputs, and `VOICE` needs Speech. `PHONE` and `KEY` always work.
     * The fallback order is `HEAD`, `TOUCH`, `KEY`. `VOICE` falls back to `HEAD` first.
     */
    fun resolve(wanted: MainYes, motion: Boolean, inputs: Boolean, speech: Boolean): MainYes = when (wanted) {
        MainYes.VOICE -> if (speech) MainYes.VOICE else resolve(MainYes.HEAD, motion, inputs, speech)
        MainYes.HEAD -> if (motion) MainYes.HEAD else resolve(MainYes.TOUCH, motion, inputs, speech)
        MainYes.TOUCH -> if (inputs) MainYes.TOUCH else MainYes.KEY
        MainYes.PHONE, MainYes.KEY -> wanted
    }
}
