package com.metaglance.core.barcode

import com.metaglance.core.image.StillPolicy

/** What a settings field for a time in milliseconds holds. */
sealed interface MsField {
    /** The field is empty: the value of the build counts again. */
    data object Empty : MsField

    /** A whole number, inside the limits of the field. */
    data class Value(val ms: Long) : MsField

    data object NotANumber : MsField
}

/**
 * The two times of the label still that a person can set on the phone.
 * `waitMs` is the time that a barcode region must be in view with no accepted code before the phone takes the still.
 * `gapMs` is the shortest time between two label stills.
 *
 * A short wait takes a still before the scanner had its chance, and each still can stop Motion for a moment.
 * A long wait makes the shopper hold the product. So both values have limits.
 *
 * The default wait is short: with the glasses, a still took 2.3 to 2.9 seconds and its label call 1.5 to 2.3
 * seconds (measured on 2026-11-14), so the shopper already waits about 5 seconds after the wait.
 */
data class LabelTiming(val waitMs: Long, val gapMs: Long) {
    /**
     * The limit of the `StillPolicy` that the label still shares with the still of the sharp second look.
     * With a longer limit than `gapMs`, that policy would drop label stills that `LabelPolicy` counted.
     */
    val stillEveryMs: Long get() = minOf(StillPolicy.DEFAULT_EVERY_MS, gapMs)

    /**
     * `regionGapMs` is the time that a region keeps its wait with no frame that shows it. A slow stream needs a longer one.
     * `onDropped` gets each still that the policy drops because its reason is gone.
     */
    fun labelPolicy(regionGapMs: Long = LabelPolicy.DEFAULT_GAP_MS, onDropped: (LabelDrop) -> Unit = {}): LabelPolicy = LabelPolicy(dwellMs = waitMs, everyMs = gapMs, gapMs = regionGapMs, onDropped = onDropped)

    companion object {
        /** The defaults of `glance.labelWaitMs` and `glance.labelGapMs` in the build of the app. */
        const val DEFAULT_WAIT_MS = 1000L
        const val DEFAULT_GAP_MS = 6000L
        val WAIT_LIMITS_MS = 300L..10_000L
        val GAP_LIMITS_MS = 2000L..60_000L
        private val WHOLE_NUMBER = Regex("[+-]?[0-9]+")

        /** Brings both values into their limits. The values of the build and of the store go through it. */
        fun within(waitMs: Long, gapMs: Long): LabelTiming = LabelTiming(waitMs.coerceIn(WAIT_LIMITS_MS), gapMs.coerceIn(GAP_LIMITS_MS))

        /** Reads the text of a settings field. A number outside `limitsMs` becomes the nearest limit. */
        fun readField(text: String, limitsMs: LongRange): MsField {
            val clean = text.trim()
            if (clean.isEmpty()) return MsField.Empty
            if (!WHOLE_NUMBER.matches(clean)) return MsField.NotANumber
            // A number with too many digits for a Long is outside each limit.
            val ms = clean.toLongOrNull() ?: if (clean.startsWith("-")) Long.MIN_VALUE else Long.MAX_VALUE
            return MsField.Value(ms.coerceIn(limitsMs))
        }
    }
}
