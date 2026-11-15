package com.metaglance.core.image

/**
 * Decides when the app takes a still photo for look-alike products: one capture at a time, and one start each
 * `everyMs` at most. A still can stop Motion, Inputs, and Speech for a moment, so the app takes few of them.
 */
class StillPolicy(private val everyMs: Long = DEFAULT_EVERY_MS) {
    private var running = false
    private var lastStartMs: Long? = null
    private var failedAtMs: Long? = null

    /** Returns false while a capture runs, and for `everyMs` after the last start. On true, call [onEnd] when the capture ends. */
    fun tryStart(nowMs: Long): Boolean {
        val last = lastStartMs
        val failed = failedAtMs
        if (running || (last != null && nowMs - last < everyMs)) return false
        if (failed != null && nowMs - failed < AFTER_FAILURE_MS) return false
        running = true
        lastStartMs = nowMs
        return true
    }

    /**
     * For a still that a person asked for, for example a reference picture: it does not wait for `everyMs`.
     * Returns false only while a capture runs. On true, call [onEnd] when the capture ends.
     */
    fun tryStartNow(nowMs: Long): Boolean {
        if (running) return false
        running = true
        lastStartMs = nowMs
        return true
    }

    fun onEnd() {
        running = false
    }

    /**
     * The capture gave no photo. A failed capture holds the link to the glasses for about 10 seconds, and frames and
     * motion samples stop for that time, so the app takes no new still by itself for [AFTER_FAILURE_MS].
     */
    fun onFailed(nowMs: Long) {
        failedAtMs = nowMs
    }

    companion object {
        const val DEFAULT_EVERY_MS = 5000L
        const val AFTER_FAILURE_MS = 45_000L
    }
}
