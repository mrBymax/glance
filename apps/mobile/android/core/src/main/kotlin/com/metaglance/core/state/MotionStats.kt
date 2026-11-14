package com.metaglance.core.state

import kotlin.math.max

/**
 * Counts the motion samples for one log line each 3 seconds, so a person can see in the log of a session how
 * the samples arrived. Call each function on one thread, or under one lock.
 *
 * - `arrivalGapMs`: the longest time with no sample. A value above 500 is a stall of the link.
 * - `timeGapMs`: the largest step between the times of two samples, on the clock of the glasses. At 30 Hz a step
 *   is 33 ms. A larger step is a sample that the glasses or the SDK lost.
 * - `burst`: the most samples that arrived together, with less than `burstGapMs` between them.
 * - `dropped`: the samples that the app could not give to a reader.
 */
class MotionStats(private val burstGapMs: Long = 20) {
    private var total = 0L
    private var new = 0
    private var arrivalGapMs = 0L
    private var timeGapMs = 0L
    private var burst = 0
    private var dropped = 0
    private var run = 0
    private var lastArrivalMs: Long? = null
    private var lastSampleNs: Long? = null

    /** `sampleNs` is the time of the sample on the clock of the glasses. `arrivalMs` is the phone time. */
    fun onSample(sampleNs: Long, arrivalMs: Long) {
        total += 1
        new += 1
        val gap = lastArrivalMs?.let { arrivalMs - it }
        if (gap != null) arrivalGapMs = max(arrivalGapMs, gap)
        run = if (gap != null && gap < burstGapMs) run + 1 else 1
        burst = max(burst, run)
        lastSampleNs?.let { timeGapMs = max(timeGapMs, (sampleNs - it) / NS_PER_MS) }
        lastArrivalMs = arrivalMs
        lastSampleNs = sampleNs
    }

    /** The app could not give one sample to a reader. */
    fun onDropped() {
        dropped += 1
    }

    /** Returns the log line for the time since the last call. The counts start again, and `samples` goes on. */
    fun take(nowMs: Long): String {
        val openGap = lastArrivalMs?.let { nowMs - it } ?: 0
        val line = "motion samples=$total new=$new arrivalGapMs=${max(arrivalGapMs, openGap)} timeGapMs=$timeGapMs burst=$burst dropped=$dropped"
        new = 0
        arrivalGapMs = 0
        timeGapMs = 0
        burst = 0
        dropped = 0
        return line
    }

    private companion object {
        const val NS_PER_MS = 1_000_000L
    }
}
