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
     * and for a window with only damaged frames. The frame of this call is the first frame of the next window.
     *
     * The next window starts where the last one ended, and not at the frame of this call. So the uploads keep the
     * pace of `everyMs` with a stream whose frames do not fall on the end of a window: a stream of 7 frames each
     * second gave one upload each 429 ms with a window of 300 ms that started at its late frame. After a gap of the
     * stream of two windows or more, the window starts at the frame.
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
        windowStartMs = if (start != null && nowMs - start < 2 * everyMs) start + everyMs else nowMs
        best = frame.takeUnless { damaged }
        bestSharpness = sharpness
        return picked
    }
}
