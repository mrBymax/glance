package com.metaglance.core.image

import com.metaglance.core.contract.Timing

/**
 * Selects the sharpest frame of each window of `everyMs` (spec section 9.5). A damaged frame (`FrameDamage`) is
 * never selected, also when it is the one frame of its window.
 */
class SharpestFramePicker<T>(private val everyMs: Long = Timing.uploadEveryMs) {
    private var windowStartMs: Long? = null
    private var best: T? = null
    private var bestSharpness = 0.0

    /**
     * Returns the sharpest frame of the window that ends with this call. Returns null while the window is open,
     * and for a window with only damaged frames. The frame of this call starts the next window.
     */
    fun offer(nowMs: Long, frame: T, sharpness: Double, damaged: Boolean = false): T? {
        val start = windowStartMs
        if (start != null && nowMs - start < everyMs) {
            if (!damaged && (best == null || sharpness > bestSharpness)) {
                best = frame
                bestSharpness = sharpness
            }
            return null
        }
        val picked = best
        windowStartMs = nowMs
        best = frame.takeUnless { damaged }
        bestSharpness = sharpness
        return picked
    }
}
