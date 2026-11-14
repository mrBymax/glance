package com.metaglance.core.input

/**
 * Puts the time of a motion sample, which is on the clock of the glasses, on the clock of the phone.
 *
 * The offset between the two clocks is the smallest value of arrival time minus sample time: the sample with
 * the shortest way from the glasses. So a sample that arrives seconds late keeps the time at which the glasses
 * took it. Use one clock for each session with the glasses.
 */
class GlassesClock {
    private var offsetMs: Long? = null
    private var lastSampleNs = Long.MIN_VALUE

    /** Returns the phone time at which the glasses took the sample. `arrivalMs` is the phone time at which it arrived. */
    fun phoneMs(sampleNs: Long, arrivalMs: Long): Long {
        val sampleMs = sampleNs / NS_PER_MS
        val delay = arrivalMs - sampleMs
        val before = offsetMs
        // The clock of the glasses never goes back. A sample time that does is a new clock, for example a new mock feed.
        val offset = if (before == null || sampleNs < lastSampleNs || delay < before) delay else before
        offsetMs = offset
        lastSampleNs = sampleNs
        return sampleMs + offset
    }

    private companion object {
        const val NS_PER_MS = 1_000_000L
    }
}
