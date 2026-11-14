package com.metaglance.core.barcode

/**
 * Decides when the phone takes one still photo of a barcode that it cannot read in the stream. A still has more
 * pixels than a frame, but it can stop Motion for a moment, so it is the last step.
 *
 * Two triggers ask for a still: a barcode region that stays in view for `dwellMs` with no accepted code, and a
 * `still.request` of the server. Both share one limit: one still each `everyMs`. The region keeps its time over
 * a gap of `gapMs`, because the scanner can miss a frame.
 *
 * A still that gave a code ends the work for its region: the frames cannot read that code, so the region would
 * ask for the same still, and give the same report, each `everyMs`. The region asks again after it left the view.
 */
class LabelPolicy(
    private val dwellMs: Long = 2500,
    private val everyMs: Long = 6000,
    private val gapMs: Long = 600
) {
    private var regionSinceMs: Long? = null
    private var regionLastMs: Long? = null
    private var lastStillMs: Long? = null
    private var regionRead = false

    /** Call it when the phone read a code in a still. A request of the server can still ask for the next still. */
    fun onStillCode() {
        regionRead = true
    }

    /**
     * Returns true when the phone must take a still now. Call it for each frame. `requested` is true for the
     * first frame after a `still.request`. A request that this call refuses is dropped. `canUpload` is false
     * while the phone sends no image, for example with the socket down: a still has no use then.
     */
    fun onFrame(nowMs: Long, regionInView: Boolean, codeAccepted: Boolean, requested: Boolean = false, canUpload: Boolean = true): Boolean {
        // The region left the view when no frame showed it for longer than the gap.
        if (regionLastMs?.let { nowMs - it > gapMs } != false) {
            regionSinceMs = null
            regionRead = false
        }
        if (regionInView) regionLastMs = nowMs
        if (codeAccepted) {
            regionSinceMs = null
            return false
        }
        if (regionInView && regionSinceMs == null) regionSinceMs = nowMs
        if (!canUpload) return false
        val waited = regionSinceMs?.let { regionInView && !regionRead && nowMs - it >= dwellMs } ?: false
        if (!requested && !waited) return false
        val last = lastStillMs
        if (last != null && nowMs - last < everyMs) return false
        lastStillMs = nowMs
        regionSinceMs = null
        return true
    }
}
