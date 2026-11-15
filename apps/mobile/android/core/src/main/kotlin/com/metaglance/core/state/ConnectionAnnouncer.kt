package com.metaglance.core.state

/**
 * Decides when the phone tells the shopper that the server connection is lost. A drop shorter than `graceMs`
 * gives no line. The server says the line of the reconnect itself.
 */
class ConnectionAnnouncer(private val graceMs: Long = 3000) {
    private var downSinceMs: Long? = null
    private var said = false

    /** The socket is down. A second call for the same drop keeps the time of the first call. */
    fun onSocketDown(nowMs: Long) {
        if (downSinceMs == null) downSinceMs = nowMs
    }

    fun onSocketOpen() {
        downSinceMs = null
        said = false
    }

    /** Returns the line to say now, or null. Each drop gives the line one time. */
    fun onTick(nowMs: Long): String? {
        val since = downSinceMs ?: return null
        if (said || nowMs - since < graceMs) return null
        said = true
        return LINE
    }

    private companion object {
        const val LINE = "Connection lost. Your cart is safe. Glances are paused."
    }
}
