package com.metaglance.core.barcode

/**
 * Decides when the phone takes one still photo of a barcode that it cannot read in the stream. A still has more
 * pixels than a frame, but it can stop Motion for a moment, so it is the last step.
 *
 * Two triggers ask for a still: a barcode region that stays in view for `dwellMs` with no accepted code, and a
 * `still.request` of the server. Both share one limit: one still each `everyMs`. The region keeps its time over
 * a gap of `gapMs`, because the scanner can miss a frame.
 */
class LabelPolicy(
    private val dwellMs: Long = 2500,
    private val everyMs: Long = 6000,
    private val gapMs: Long = 600
) {
    private var regionSinceMs: Long? = null
    private var regionLastMs = 0L
    private var lastStillMs: Long? = null

    /**
     * Returns true when the phone must take a still now. Call it for each frame. `requested` is true for the
     * first frame after a `still.request`. A request that this call refuses is dropped.
     */
    fun onFrame(nowMs: Long, regionInView: Boolean, codeAccepted: Boolean, requested: Boolean = false): Boolean {
        if (codeAccepted) {
            regionSinceMs = null
            return false
        }
        if (regionSinceMs != null && nowMs - regionLastMs > gapMs) regionSinceMs = null
        if (regionInView) {
            if (regionSinceMs == null) regionSinceMs = nowMs
            regionLastMs = nowMs
        }
        val waited = regionSinceMs?.let { regionInView && nowMs - it >= dwellMs } ?: false
        if (!requested && !waited) return false
        val last = lastStillMs
        if (last != null && nowMs - last < everyMs) return false
        lastStillMs = nowMs
        regionSinceMs = null
        return true
    }
}
