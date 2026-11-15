package com.metaglance.core.net

/** The wait before each new connection attempt. The last step repeats. */
class Backoff(private val stepsMs: List<Long> = listOf(500, 1000, 2000, 4000, 8000)) {
    init {
        require(stepsMs.isNotEmpty()) { "A backoff needs one step or more." }
    }

    /** `attempt` is 0 for the first attempt after an open connection. */
    fun delayMs(attempt: Int): Long = stepsMs[attempt.coerceIn(0, stepsMs.size - 1)]
}

/** Runs a block after a delay. `schedule` returns a function that cancels the block. */
fun interface Scheduler {
    fun schedule(delayMs: Long, block: () -> Unit): () -> Unit
}
