package com.metaglance.core.state

/**
 * Decides if the app starts a capability again after it stopped with no request from the app.
 * A capability that never ran is not started. A start that works sets the count back to 0, so `maxAttempts`
 * limits the starts in a row that do not work.
 */
class Revival(private val maxAttempts: Int = 3) {
    private var ran = false

    /** The number of starts since the capability last ran. */
    var attempts = 0
        private set

    fun onStarted() {
        ran = true
        attempts = 0
    }

    /** Returns true if the caller must start the capability again now. */
    fun onStopped(byApp: Boolean): Boolean {
        if (!ran) return false
        if (byApp) {
            ran = false
            return false
        }
        if (attempts >= maxAttempts) return false
        attempts += 1
        return true
    }
}
