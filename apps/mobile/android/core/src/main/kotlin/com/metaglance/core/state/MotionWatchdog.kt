package com.metaglance.core.state

import kotlin.math.max

/** `IDLE`: Motion does not run. `FLOWING`: samples arrive. `STALLED`: Motion runs, and no sample arrives. */
enum class MotionFlow { IDLE, FLOWING, STALLED }

/**
 * Watches the arrival times of the motion samples. The link to the glasses stalls for seconds: at the start of
 * a session, around a still photo, and at other times. Motion stays `STARTED` in a stall, so only the samples
 * show it. Most samples of a stall arrive together when it ends.
 *
 * The flow is `STALLED` when Motion runs and no sample arrived for `stallMs`. It is `FLOWING` again after
 * `flowSamples` samples in a row with less than `stallMs` between them.
 *
 * A stall of `restartAfterMs` asks for a restart of Motion, `maxRestarts` times in a row at most. It asks only
 * while video frames arrive, because a link with no frames is down for each stream, and never during a still.
 *
 * Each time is a phone time in ms. Call each function on one thread, or under one lock.
 */
class MotionWatchdog(
    private val stallMs: Long = 500,
    private val flowSamples: Int = 10,
    private val restartAfterMs: Long = 10_000,
    private val maxRestarts: Int = 3,
    private val burstGapMs: Long = 20
) {
    /** `lines` are log lines. With `restart`, the caller stops Motion and starts it again. */
    class Tick(val lines: List<String>, val restart: Boolean)

    var flow = MotionFlow.IDLE
        private set

    /** The arrival time of the last sample before the flow stalled. null while the flow is not `STALLED`. */
    var stalledSinceMs: Long? = null
        private set

    /** The time of the last sample, or of the start of Motion before the first sample. */
    private var lastArrivalMs = 0L

    /** The samples in a row with no gap since the stall. */
    private var run = 0

    /** The length of the stall whose log line waits for the end of its burst. null when no line waits. */
    private var stallLengthMs: Long? = null

    /** The samples that arrived together after the stall. */
    private var burst = 0
    private var restarts = 0

    /** No restart comes before `restartAfterMs` after this time: the last restart, or the last tick with a still. */
    private var restartBaseMs = 0L

    /**
     * Motion reported `STARTED`. After a restart of this watchdog, the flow stays `STALLED` until samples arrive.
     * The count of the restarts in a row goes on: only samples that flow set it back.
     */
    fun onStarted(nowMs: Long) {
        if (flow != MotionFlow.IDLE) return
        flow = MotionFlow.FLOWING
        lastArrivalMs = nowMs
        restartBaseMs = nowMs
        run = 0
        stallLengthMs = null
    }

    /** Motion reported a state that is not `STARTED`, and this watchdog did not ask for it. */
    fun onNotStarted() {
        flow = MotionFlow.IDLE
        stalledSinceMs = null
        stallLengthMs = null
    }

    /** A sample arrived. Returns the log line of a stall whose burst this sample ended, or null. */
    fun onSample(nowMs: Long): String? {
        val gap = nowMs - lastArrivalMs
        lastArrivalMs = nowMs
        // The first samples can arrive before the state `STARTED` does.
        if (flow == MotionFlow.IDLE) return null
        var line: String? = null
        if (gap >= stallMs) {
            line = takeStallLine()
            stall(nowMs - gap)
            stallLengthMs = gap
            burst = 1
            run = 1
        } else {
            if (stallLengthMs != null) {
                if (gap < burstGapMs) burst += 1 else line = takeStallLine()
            }
            if (flow == MotionFlow.STALLED) run += 1
        }
        if (flow == MotionFlow.STALLED && run >= flowSamples) {
            flow = MotionFlow.FLOWING
            stalledSinceMs = null
            restarts = 0
        }
        return line
    }

    /** Call it about 10 times each second. `framesFlow` is true when a video frame arrived in the last second. */
    fun onTick(nowMs: Long, framesFlow: Boolean, stillRuns: Boolean): Tick {
        if (flow == MotionFlow.IDLE) return NOTHING
        val lines = ArrayList<String>(2)
        val silentMs = nowMs - lastArrivalMs
        if (silentMs >= burstGapMs) takeStallLine()?.let(lines::add)
        if (flow == MotionFlow.FLOWING && silentMs >= stallMs) {
            stall(lastArrivalMs)
            lines.add("motion stalled: no sample for $silentMs ms")
        }
        // A still stalls the samples by itself, so the wait starts again after it.
        if (stillRuns) restartBaseMs = nowMs
        val waitedMs = nowMs - max(lastArrivalMs, restartBaseMs)
        val restart = flow == MotionFlow.STALLED && framesFlow && !stillRuns && restarts < maxRestarts && waitedMs >= restartAfterMs
        if (restart) {
            restarts += 1
            restartBaseMs = nowMs
            lines.add("motion restart $restarts of $maxRestarts: no sample for $silentMs ms")
        }
        return if (lines.isEmpty() && !restart) NOTHING else Tick(lines, restart)
    }

    private fun stall(sinceMs: Long) {
        if (flow != MotionFlow.FLOWING) return
        flow = MotionFlow.STALLED
        stalledSinceMs = sinceMs
        run = 0
    }

    private fun takeStallLine(): String? = stallLengthMs?.let {
        stallLengthMs = null
        "motion stall $it ms, burst $burst"
    }

    private companion object {
        val NOTHING = Tick(emptyList(), false)
    }
}
