package com.metaglance.android.pipeline

/**
 * The time of each step of the frame path, for the log. One thread uses it.
 * `report` gives one line each 10 seconds: for each step the count of runs, the mean, and the longest run.
 */
internal class StepTimes(private val everyMs: Long = 10_000) {
    private class Step {
        var runs = 0
        var totalNs = 0L
        var maxNs = 0L
    }

    private val steps = LinkedHashMap<String, Step>()
    private var reportedAtMs = -1L

    inline fun <T> of(name: String, block: () -> T): T {
        val startNs = System.nanoTime()
        try {
            return block()
        } finally {
            add(name, System.nanoTime() - startNs)
        }
    }

    fun add(name: String, ns: Long) {
        val step = steps.getOrPut(name) { Step() }
        step.runs += 1
        step.totalNs += ns
        if (ns > step.maxNs) step.maxNs = ns
    }

    /** The line of the last period, or null when the period still runs or held no step. */
    fun report(nowMs: Long): String? {
        if (reportedAtMs < 0) reportedAtMs = nowMs
        if (nowMs - reportedAtMs < everyMs) return null
        reportedAtMs = nowMs
        if (steps.isEmpty()) return null
        val line = steps.entries.joinToString(", ") { (name, step) ->
            val meanMs = step.totalNs / step.runs / 1_000_000.0
            "$name ${step.runs}x mean ${"%.1f".format(meanMs)} max ${"%.1f".format(step.maxNs / 1_000_000.0)} ms"
        }
        steps.clear()
        return "frame path: $line"
    }
}
