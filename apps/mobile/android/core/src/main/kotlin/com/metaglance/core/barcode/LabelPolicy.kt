package com.metaglance.core.barcode

/** A still that `LabelPolicy` did not take because the reason for it is gone. */
enum class LabelDrop {
    /** A `still.request` of the server. */
    REQUEST,

    /** A barcode region that asked for its still behind a prompt. */
    REGION
}

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
 *
 * A region that stays in view asks for `maxRegionStills` stills at most. The scanner can report a region where
 * no barcode is, and such a region must not stop Motion and cost a model call each `everyMs` for a full shop.
 *
 * A still that waits behind a prompt dies with its reason. In the session of 2026-11-14 a request waited
 * 7 seconds behind two prompts, and the phone took its still 47 ms after the nod that added the product.
 * `onDropped` gets each still that the policy drops for this reason.
 */
class LabelPolicy(
    private val dwellMs: Long = LabelTiming.DEFAULT_WAIT_MS,
    private val everyMs: Long = LabelTiming.DEFAULT_GAP_MS,
    private val gapMs: Long = DEFAULT_GAP_MS,
    private val maxRegionStills: Int = 3,
    private val onDropped: (LabelDrop) -> Unit = {}
) {
    private var regionSinceMs: Long? = null
    private var regionLastMs: Long? = null
    private var lastStillMs: Long? = null
    private var regionRead = false
    private var regionStills = 0

    /** The arrival time of the request that waits behind a prompt. */
    private var heldRequestMs: Long? = null

    /** The time at which the region asked for its still behind a prompt. */
    private var regionHeldMs: Long? = null

    /** Call it when the phone read a code in a still. A request of the server can still ask for the next still. */
    fun onStillCode() {
        regionRead = true
    }

    /**
     * Returns true when the phone must take a still now. Call it for each frame. `requested` is true for the
     * first frame after a `still.request`, and `requestMs` is the time at which that request arrived. A request
     * that this call refuses is dropped. `canUpload` is false while the phone sends no image, for example with
     * the socket down: a still has no use then.
     *
     * `hold` is true while a prompt waits for a head answer: a still stalls the motion samples, so none starts.
     * The hold uses no still gap and no still of the region. A request waits in a hold, and it is dropped when
     * the hold ends, or [STALE_MS] after it arrived: the prompt got its answer or ended, so the product has its
     * name, or the shopper put it down. A request that is [STALE_MS] old when its first frame arrives is dropped
     * too. A region that asked in a hold starts its time in view again at the same two moments.
     */
    fun onFrame(
        nowMs: Long,
        regionInView: Boolean,
        codeAccepted: Boolean,
        requested: Boolean = false,
        canUpload: Boolean = true,
        hold: Boolean = false,
        requestMs: Long = nowMs
    ): Boolean {
        val request = takeRequest(nowMs, requested, requestMs, hold)
        // The region left the view when no frame showed it for longer than the gap.
        if (regionLastMs?.let { nowMs - it > gapMs } != false) {
            regionSinceMs = null
            regionRead = false
            regionStills = 0
            regionHeldMs = null
        }
        if (regionInView) regionLastMs = nowMs
        if (codeAccepted) {
            regionSinceMs = null
            regionHeldMs = null
            return false
        }
        if (regionInView && regionSinceMs == null) regionSinceMs = nowMs
        followRegionInHold(nowMs, regionInView, hold)
        if (!canUpload || hold) return false
        val waited = regionAsks(nowMs, regionInView)
        if (!request && !waited) return false
        val last = lastStillMs
        if (last != null && nowMs - last < everyMs) return false
        lastStillMs = nowMs
        if (waited) regionStills += 1
        regionSinceMs = null
        return true
    }

    /** Returns true for a request that can start a still in this frame. It keeps a request that meets a hold, and drops a stale one. */
    private fun takeRequest(nowMs: Long, requested: Boolean, requestMs: Long, hold: Boolean): Boolean {
        val heldMs = heldRequestMs
        if (heldMs != null && (!hold || requested || nowMs - heldMs >= STALE_MS)) {
            heldRequestMs = null
            // A new request takes the place of the one that waits, with no drop.
            if (!requested) onDropped(LabelDrop.REQUEST)
        }
        if (!requested) return false
        if (nowMs - requestMs >= STALE_MS) {
            onDropped(LabelDrop.REQUEST)
            return false
        }
        if (hold) heldRequestMs = requestMs
        return !hold
    }

    /** True when the region was in view for its time, and can still get a still. */
    private fun regionAsks(nowMs: Long, regionInView: Boolean): Boolean = regionSinceMs?.let { regionInView && !regionRead && regionStills < maxRegionStills && nowMs - it >= dwellMs } ?: false

    /**
     * Follows a region that asks for its still in a hold. The region starts its time in view again when the hold
     * ends, and when it asked [STALE_MS] ago.
     */
    private fun followRegionInHold(nowMs: Long, regionInView: Boolean, hold: Boolean) {
        val heldMs = regionHeldMs
        if (heldMs == null) {
            if (hold && regionAsks(nowMs, regionInView)) regionHeldMs = nowMs
            return
        }
        if (hold && nowMs - heldMs < STALE_MS) return
        regionHeldMs = null
        regionSinceMs = if (regionInView) nowMs else null
        onDropped(LabelDrop.REGION)
    }

    companion object {
        const val DEFAULT_GAP_MS = 600L

        /**
         * A still that waits is dropped after this time. The server waits 5 seconds for the label frame of its
         * request, and a still takes 2.3 to 4.8 seconds, so an older request gives a frame that nobody waits for.
         */
        const val STALE_MS = 3000L
    }
}
