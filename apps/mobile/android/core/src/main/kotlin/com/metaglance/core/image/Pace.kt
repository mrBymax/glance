package com.metaglance.core.image

/** Limits a slow step of the frame path, for example OCR: one run each `everyMs` at most. */
class Pace(private val everyMs: Long) {
    private var lastRunMs: Long? = null

    /** Returns true when the step can run now, and counts that run. */
    fun tryRun(nowMs: Long): Boolean {
        val last = lastRunMs
        if (last != null && nowMs - last < everyMs) return false
        lastRunMs = nowMs
        return true
    }
}
