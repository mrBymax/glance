package com.metaglance.core.kiosk

import com.metaglance.core.contract.Timing

/** One kiosk code in a frame. `areaPx` is the area of its QR code in frame pixels. */
data class SeenCode(val code: String, val areaPx: Int)

/**
 * Decides when the phone reports a kiosk code (rule R14 of the spec). The dwell follows one code, the candidate.
 * A candidate keeps its dwell over a gap of `gapMs`, because the scanner can miss a frame.
 * Another code takes over only when its area is more than `switchRatio` times the last area of the candidate,
 * so two codes of similar size do not swap.
 */
class KioskDwell(
    private val dwellMs: Long = Timing.kioskDwellMs,
    private val repeatMs: Long = 1000,
    private val gapMs: Long = 600,
    private val switchRatio: Double = 1.2
) {
    private var candidate: String? = null
    private var lastAreaPx = 0
    private var lastSeenMs = 0L
    private var dwellStartMs = 0L
    private var lastReportMs: Long? = null

    /** Returns the code to report now, or null. Call it for each scanned frame, also for a frame with no code. */
    fun onFrame(nowMs: Long, codes: List<SeenCode>): String? {
        if (candidate != null && nowMs - lastSeenMs > gapMs) candidate = null

        val followed = candidate
        if (followed == null) {
            follow(codes.maxByOrNull { it.areaPx } ?: return null, nowMs)
        } else {
            val other = codes.filter { it.code != followed }.maxByOrNull { it.areaPx }
            if (other != null && other.areaPx > switchRatio * lastAreaPx) follow(other, nowMs)
        }

        val seen = codes.filter { it.code == candidate }.maxByOrNull { it.areaPx } ?: return null
        lastAreaPx = seen.areaPx
        lastSeenMs = nowMs
        if (nowMs - dwellStartMs < dwellMs) return null
        val lastReport = lastReportMs
        if (lastReport != null && nowMs - lastReport < repeatMs) return null
        lastReportMs = nowMs
        return seen.code
    }

    private fun follow(code: SeenCode, nowMs: Long) {
        candidate = code.code
        lastAreaPx = code.areaPx
        lastSeenMs = nowMs
        dwellStartMs = nowMs
        lastReportMs = null
    }
}
