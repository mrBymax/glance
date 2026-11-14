package com.metaglance.core.image

/**
 * Decides when the app takes a still photo for look-alike products: one capture at a time, and one start each
 * `everyMs` at most. A still can stop Motion, Inputs, and Speech for a moment, so the app takes few of them.
 */
class StillPolicy(private val everyMs: Long = 5000) {
    private var running = false
    private var lastStartMs: Long? = null

    /** Returns false while a capture runs, and for `everyMs` after the last start. On true, call [onEnd] when the capture ends. */
    fun tryStart(nowMs: Long): Boolean {
        val last = lastStartMs
        if (running || (last != null && nowMs - last < everyMs)) return false
        running = true
        lastStartMs = nowMs
        return true
    }

    fun onEnd() {
        running = false
    }
}
