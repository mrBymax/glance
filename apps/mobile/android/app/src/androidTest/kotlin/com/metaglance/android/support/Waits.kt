package com.metaglance.android.support

import android.os.SystemClock

private const val POLL_MS = 50L

/** Waits until `condition` holds. Fails with `what` and the text of `state` after `timeoutMs`. */
fun waitUntil(what: String, timeoutMs: Long, state: () -> String = { "" }, condition: () -> Boolean) {
    val end = SystemClock.elapsedRealtime() + timeoutMs
    while (!condition()) {
        if (SystemClock.elapsedRealtime() >= end) {
            val detail = state().let { if (it.isEmpty()) "" else " State: $it" }
            throw AssertionError("Waited $timeoutMs ms for: $what.$detail")
        }
        Thread.sleep(POLL_MS)
    }
}

/** Waits until `read` returns a value, and returns it. */
fun <T : Any> waitFor(what: String, timeoutMs: Long, state: () -> String = { "" }, read: () -> T?): T {
    var value: T? = null
    waitUntil(what, timeoutMs, state) {
        value = read()
        value != null
    }
    return checkNotNull(value)
}
