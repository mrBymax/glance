package com.metaglance.core.state

/**
 * The limit of the time that a session waits for glasses that disconnected. The session service runs for this
 * time, with a wake lock, so the wait must end. After the limit, the shopper starts the camera from the app.
 */
class GlassesWait(private val limitMs: Long = LIMIT_MS) {
    private var sinceMs: Long? = null

    fun start(nowMs: Long) {
        sinceMs = nowMs
    }

    fun end() {
        sinceMs = null
    }

    fun isOver(nowMs: Long): Boolean = sinceMs?.let { nowMs - it >= limitMs } ?: false

    private companion object {
        const val LIMIT_MS = 5 * 60 * 1000L
    }
}
