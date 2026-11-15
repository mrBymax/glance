package com.metaglance.core.input

import com.metaglance.core.contract.DeviceToServer
import com.metaglance.core.contract.IntentKind
import com.metaglance.core.contract.IntentSource
import com.metaglance.core.contract.Profile
import com.metaglance.core.contract.YesGesture
import com.metaglance.core.gesture.GyroSample
import com.metaglance.core.gesture.HeadGesture
import com.metaglance.core.gesture.HeadGestureDetector
import com.metaglance.core.gesture.HeadSample
import kotlin.math.max
import kotlin.math.min

/** Sees the head windows and their samples, for the log and for a recorder. Each call runs inside a call of [HeadInput]. */
interface HeadWindowListener {
    /** The head window of a prompt started. A gesture counts when it starts at `openMs` or later, which can be later than this call. */
    fun onOpen(promptId: String, openMs: Long)

    /**
     * The detector got this sample. `arrivalMs` is the phone time at which the sample arrived. The first samples
     * can be from the [HeadInput.LEAD_IN_MS] before `openMs`.
     */
    fun onSample(sample: HeadSample, arrivalMs: Long)

    /** No other sample of this head window follows. */
    fun onClose(promptId: String)

    /** The detector found a gesture that started `earlyMs` before the head window opened. It is no answer. */
    fun onEarly(promptId: String, gesture: HeadGesture, earlyMs: Long) {}
}

/**
 * Turns a nod or a shake into a yes or a no, while a prompt has its head window open.
 *
 * The head window is in the time of the samples: a gesture counts when the glasses took its samples after the
 * window opened and before the window ended. So a nod whose samples arrive seconds late still counts, up to
 * [LATE_MS] after the window.
 *
 * A movement that started before the window never counts. The detector also gets the samples of the [LEAD_IN_MS]
 * before the window, so it knows a head that already moves when the window opens. A gesture is no answer when
 * its movement started before the window: a head that moves when the window opens must come to rest before
 * its gesture. Without this rule, the rest of a slow look down and the look back up were a nod.
 *
 * `PromptTracker.headPrompt` gives the time at which the window opens: for each prompt while its line still
 * plays. The length of the window counts from the end of the line.
 *
 * The time of the window does not run while it is blocked: while the motion samples are stalled, and while a
 * still photo is taken, which stalls them. A block adds [MAX_EXTRA_MS] to a window at most. Blocked time before
 * the end of the line adds nothing, because the length of the window does not run then.
 *
 * Each function can run on each thread.
 */
class HeadInput(
    private val detector: HeadGestureDetector,
    private val prompts: PromptTracker,
    private val listener: HeadWindowListener? = null
) {
    /**
     * `doneMs` is the end of the line of the prompt, as [HeadPrompt] gives it. `lengthMs` is null for a window with
     * no end. `extraMs` is the blocked time that ended.
     */
    private class Window(val promptId: String, val openMs: Long, var doneMs: Long, val lengthMs: Long?) {
        var extraMs = 0L
        var answered = false
        var closed = false
    }

    /** The head window that the detector follows. */
    private var window: Window? = null
    private var blockedSinceMs: Long? = null
    private var closed = false
    private val clock = GlassesClock()

    /** For a sample with no accelerometer reading. */
    fun onSample(sample: GyroSample, arrivalMs: Long, profile: Profile): DeviceToServer.Intent? = onSample(HeadSample(sample, null), arrivalMs, profile)

    /** `arrivalMs` is the phone time at which the sample arrived. Returns the answer that this sample completes, or null. */
    @Synchronized
    fun onSample(sample: HeadSample, arrivalMs: Long, profile: Profile): DeviceToServer.Intent? {
        val takenMs = clock.phoneMs(sample.gyro.tNs, arrivalMs)
        val w = follow(profile) ?: return null
        if (w.closed || takenMs < w.openMs - LEAD_IN_MS) return null
        val end = endMs(w, arrivalMs)
        if (end != null && (takenMs >= end || arrivalMs >= end + LATE_MS)) return null
        listener?.onSample(sample, arrivalMs)
        val gesture = detector.onSample(sample) ?: return null
        val earlyMs = w.openMs - (takenMs - detector.lastGestureMs)
        if (earlyMs > 0) {
            listener?.onEarly(w.promptId, gesture, earlyMs)
            return null
        }
        w.answered = true
        val yesGesture = if (profile.yesGesture == YesGesture.NOD) HeadGesture.NOD else HeadGesture.SHAKE
        val kind = if (gesture == yesGesture) IntentKind.YES else IntentKind.NO
        return DeviceToServer.Intent(kind, IntentSource.HEAD, w.promptId)
    }

    /**
     * Says that no motion sample can arrive now, or that samples arrive again. `atMs` is the phone time at
     * which that state started. A call that repeats the state changes nothing.
     */
    @Synchronized
    fun setBlocked(blocked: Boolean, atMs: Long, profile: Profile) {
        val w = follow(profile)
        val since = blockedSinceMs
        if (blocked) {
            if (since == null) blockedSinceMs = atMs
        } else if (since != null) {
            w?.let { it.extraMs = extraMs(it, atMs) }
            blockedSinceMs = null
        }
    }

    /**
     * True while a prompt waits for a head answer: from the start of its line to its answer, to the event that
     * ends it, or to the end of its head window. No still photo starts in that time, because a still stalls
     * the motion samples for seconds.
     */
    @Synchronized
    fun holdsStills(nowMs: Long, profile: Profile): Boolean {
        if (!profile.headGestures) return false
        if (prompts.linePlaying(nowMs)) return true
        val w = follow(profile) ?: return false
        if (w.answered) return false
        return nowMs < (endMs(w, nowMs) ?: (w.doneMs + NO_WINDOW_HOLD_MS))
    }

    /** Call it some times each second. It ends a head window for the listener when no late sample can count. */
    @Synchronized
    fun onTick(nowMs: Long, profile: Profile) {
        val w = follow(profile) ?: return
        val end = endMs(w, nowMs) ?: return
        if (!w.closed && nowMs >= end + LATE_MS) close(w)
    }

    /**
     * Ends the head window for the listener. Call it before the session drops this object. After the call, this
     * object takes no sample: the motion thread can still hold it for one sample.
     */
    @Synchronized
    fun close() {
        window?.let { if (!it.closed) close(it) }
        window = null
        closed = true
    }

    /** Returns the head window of the current prompt. A new window starts the detector from rest. */
    private fun follow(profile: Profile): Window? {
        if (closed) return null
        val prompt = if (profile.headGestures) prompts.headPrompt() else null
        val w = window
        val same = if (prompt == null) w == null else w != null && w.promptId == prompt.promptId && w.openMs == prompt.openMs && w.lengthMs == profile.headWindowMs
        if (same) {
            // The line of a window that is open can end.
            if (w != null && prompt != null) w.doneMs = prompt.doneMs
            return w
        }
        if (w != null && !w.closed) close(w)
        // A movement in the window of another prompt is no answer.
        detector.reset()
        return prompt?.let { Window(it.promptId, it.openMs, it.doneMs, profile.headWindowMs) }.also {
            window = it
            if (it != null) listener?.onOpen(it.promptId, it.openMs)
        }
    }

    private fun close(w: Window) {
        w.closed = true
        listener?.onClose(w.promptId)
    }

    /** The phone time at which the window ends, as known at `nowMs`. null for a window with no end. */
    private fun endMs(w: Window, nowMs: Long): Long? = w.lengthMs?.let { w.doneMs + it + extraMs(w, nowMs) }

    /** The blocked time of the window up to `untilMs`. */
    private fun extraMs(w: Window, untilMs: Long): Long {
        val since = blockedSinceMs ?: return w.extraMs
        val length = w.lengthMs ?: return w.extraMs
        val from = max(since, w.doneMs)
        // A block that starts after the end of the window does not open the window again.
        if (from >= w.doneMs + length + w.extraMs) return w.extraMs
        return min(MAX_EXTRA_MS, w.extraMs + max(0, untilMs - from))
    }

    companion object {
        /**
         * The detector gets the samples of this time before the window opens. The detector calls a head at rest
         * after 250 ms with no movement (`holdMs`), so a head that is at rest in this time can nod when the window opens.
         */
        const val LEAD_IN_MS = 300L

        /** A sample that the glasses took inside the window counts when it arrives this long after the window, at most. */
        const val LATE_MS = 6000L

        /** The longest time that blocks add to one head window. The longest stall of the test of 2026-11-14 took 12 seconds. */
        const val MAX_EXTRA_MS = 15_000L

        /** With no head window in the profile, a prompt holds the stills for this time after its line. */
        const val NO_WINDOW_HOLD_MS = 30_000L
    }
}
