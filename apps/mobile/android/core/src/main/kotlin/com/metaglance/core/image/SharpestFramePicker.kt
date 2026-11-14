package com.metaglance.core.image

import com.metaglance.core.contract.Timing

/** Selects the sharpest frame of each window of `everyMs` (spec section 9.5). */
class SharpestFramePicker<T>(private val everyMs: Long = Timing.uploadEveryMs) {
    private var windowStartMs: Long? = null
    private var best: T? = null
    private var bestSharpness = 0.0

    /**
     * Returns the sharpest frame of the window that ends with this call, or null while the window is open.
     * The frame of this call starts the next window.
     */
    fun offer(nowMs: Long, frame: T, sharpness: Double): T? {
        val start = windowStartMs
        if (start != null && nowMs - start < everyMs) {
            if (sharpness > bestSharpness) {
                best = frame
                bestSharpness = sharpness
            }
            return null
        }
        val picked = best
        windowStartMs = nowMs
        best = frame
        bestSharpness = sharpness
        return picked
    }
}
