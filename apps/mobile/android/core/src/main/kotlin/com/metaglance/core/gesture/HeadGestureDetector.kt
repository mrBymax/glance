package com.metaglance.core.gesture

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.roundToLong
import kotlin.math.sign

/**
 * Finds nods and shakes in gyroscope samples. Each time is the time of a sample, so samples that arrive late
 * and together give the same result as samples that arrive one by one.
 *
 * The detector integrates the pitch rate and the yaw rate to an angle, and cuts each angle into strokes.
 * A stroke is a movement in one direction. It ends at a reversal, or when the head is quiet for `holdMs`.
 *
 * A nod is two opposite pitch strokes with no rest between them, down first or up first. The detector reports
 * it when the second stroke has brought the head back to 40 percent of the largest stroke or less. So a look
 * down at a product, which does not return, is not a nod.
 *
 * A shake is two opposite yaw strokes and the start of a third one. One yaw pair is a look to the side and back.
 *
 * After a gesture, the detector reports no other gesture before the head was quiet, so a nod with many cycles
 * is one nod. `onReport` gets each stroke pair that the detector accepted or rejected.
 */
class HeadGestureDetector(private val config: HeadGestureConfig, private val onReport: (GestureReport) -> Unit = {}) {
    private enum class ClosedBy { REVERSAL, SETTLE }

    private class Stroke(
        val startAngle: Double,
        val endAngle: Double,
        val peak: Double,
        val startMs: Double,
        val endMs: Double,
        val closedBy: ClosedBy
    ) {
        val amp: Double get() = abs(endAngle - startAngle)
    }

    private class AnglePoint(val tMs: Double, val pitch: Double, val yaw: Double)

    private inner class AxisTracker {
        var angle = 0.0

        /** The last stroke that ended. */
        var last: Stroke? = null

        /** 0 while no stroke is open. */
        var dir = 0
        private var anchor = 0.0
        private var anchorMs = 0.0
        private var extreme = 0.0
        private var extremeMs = 0.0
        private var peak = 0.0
        private var backPeak = 0.0
        private var quietSinceMs: Double? = null

        /** The open stroke as if it ended at its largest angle. null while no stroke is open. */
        fun open(): Stroke? = if (dir == 0) null else Stroke(anchor, extreme, peak, anchorMs, extremeMs, ClosedBy.REVERSAL)

        /** Adds one sample with the rate `w` in rad/s. Returns the strokes that this sample closed, oldest first. */
        fun step(tMs: Double, w: Double, dtS: Double): List<Stroke> {
            val closed = ArrayList<Stroke>(2)
            angle += w * dtS
            if (dir == 0) {
                if (abs(w) < config.restRadS) {
                    anchor = angle
                    anchorMs = tMs
                    peak = 0.0
                } else {
                    peak = max(peak, abs(w))
                }
                if (abs(angle - anchor) >= config.minStrokeRad) {
                    dir = sign(angle - anchor).toInt()
                    extreme = angle
                    extremeMs = tMs
                }
            } else {
                // The movement back from the largest angle belongs to the next stroke, also before the reversal counts.
                if (sign(w).toInt() == dir) peak = max(peak, abs(w)) else backPeak = max(backPeak, abs(w))
                val d = angle - extreme
                if (d == 0.0 || sign(d).toInt() == dir) {
                    extreme = angle
                    extremeMs = tMs
                    backPeak = 0.0
                } else if (abs(d) >= config.minStrokeRad) {
                    closed.add(Stroke(anchor, extreme, peak, anchorMs, extremeMs, ClosedBy.REVERSAL))
                    anchor = extreme
                    anchorMs = extremeMs
                    dir = -dir
                    extreme = angle
                    extremeMs = tMs
                    peak = backPeak
                    backPeak = 0.0
                }
            }
            val quietSince = if (abs(w) < config.settleRadS) quietSinceMs ?: tMs else null
            quietSinceMs = quietSince
            if (dir != 0 && quietSince != null && tMs - quietSince >= config.holdMs) {
                closed.add(Stroke(anchor, angle, peak, anchorMs, quietSince, ClosedBy.SETTLE))
                anchor = angle
                anchorMs = tMs
                dir = 0
                peak = 0.0
                backPeak = 0.0
            }
            closed.lastOrNull()?.let { last = it }
            return closed
        }
    }

    private val axes = HeadAxes(config)
    private var pitch = AxisTracker()
    private var yaw = AxisTracker()
    private val angles = ArrayDeque<AnglePoint>()
    private var lastSampleMs: Double? = null

    /** False from a gesture until the head was quiet again. */
    private var armed = true
    private var quietUntilMs = 0.0

    /** For a sample with no accelerometer reading. */
    fun onSample(sample: GyroSample): HeadGesture? = onSample(HeadSample(sample, null))

    /** Returns the gesture that this sample completes, or null. */
    fun onSample(sample: HeadSample): HeadGesture? {
        val tMs = sample.gyro.tNs / NS_PER_MS
        val last = lastSampleMs
        var dtS = if (last == null) 0.0 else (tMs - last) / MS_PER_S
        if (last == null || dtS <= 0.0 || dtS * MS_PER_S > config.gapResetMs) {
            reset()
            dtS = DEFAULT_STEP_S
        }
        lastSampleMs = tMs

        val pitchBefore = pitch.last
        val yawBefore = yaw.last
        val rates = axes.rates(sample, dtS)
        val pitchClosed = pitch.step(tMs, rates.pitch, dtS)
        val yawClosed = yaw.step(tMs, rates.yaw, dtS)
        angles.addLast(AnglePoint(tMs, pitch.angle, yaw.angle))
        while (angles.first().tMs < tMs - ANGLE_HISTORY_MS) angles.removeFirst()

        if (!armed) {
            if (tMs >= quietUntilMs && pitch.dir == 0 && yaw.dir == 0) {
                armed = true
                pitch.last = null
                yaw.last = null
            }
            return null
        }

        val gesture = closedNod(pitchBefore, pitchClosed) ?: openNod(tMs) ?: closedShake(yawBefore, yawClosed, tMs) ?: return null
        armed = false
        quietUntilMs = tMs + config.refractoryMs
        return gesture
    }

    /** Forgets each stroke and each angle. The next sample starts from rest. */
    fun reset() {
        axes.reset()
        pitch = AxisTracker()
        yaw = AxisTracker()
        angles.clear()
        lastSampleMs = null
        armed = true
        quietUntilMs = 0.0
    }

    /** True if `second` followed `first` at a reversal, with no rest between them. */
    private fun joined(first: Stroke, second: Stroke): Boolean = first.closedBy == ClosedBy.REVERSAL && first.endMs == second.startMs

    /** A pitch pair whose second stroke ended. In most cases it was no nod while the stroke was open, so it is rejected. */
    private fun closedNod(before: Stroke?, closed: List<Stroke>): HeadGesture? {
        var first = before
        for (second in closed) {
            if (first != null && joined(first, second)) {
                val fault = nodFault(first, second, second.endMs, second.endAngle)
                report(HeadGesture.NOD, first, second, second.endMs, second.endAngle, fault)
                if (fault == null) return HeadGesture.NOD
            }
            first = second
        }
        return null
    }

    private fun openNod(tMs: Double): HeadGesture? {
        val first = pitch.last ?: return null
        val second = pitch.open() ?: return null
        if (!joined(first, second) || nodFault(first, second, tMs, pitch.angle) != null) return null
        report(HeadGesture.NOD, first, second, tMs, pitch.angle, null)
        return HeadGesture.NOD
    }

    /** `nowMs` and `angle` are the time and the pitch angle of the decision. */
    private fun nodFault(first: Stroke, second: Stroke, nowMs: Double, angle: Double): Rejected? {
        val largest = max(first.amp, second.amp)
        return when {
            largest > config.maxNodRad -> Rejected.AMPLITUDE
            first.peak < config.minPeakRadS || second.peak < config.minPeakRadS -> Rejected.PEAK
            nowMs - first.startMs > config.maxNodMs -> Rejected.TIME
            span(first.startMs) { it.yaw } > largest / config.dominance -> Rejected.DOMINANCE
            abs(angle - first.startAngle) > RETURN_RATIO * largest -> Rejected.NET_ANGLE
            else -> null
        }
    }

    private fun closedShake(before: Stroke?, closed: List<Stroke>, tMs: Double): HeadGesture? {
        var first = before
        for (second in closed) {
            if (first != null && joined(first, second)) {
                val fault = shakeFault(first, second, tMs)
                report(HeadGesture.SHAKE, first, second, if (fault == Rejected.TWO_STROKES) second.endMs else tMs, second.endAngle, fault)
                if (fault == null) return HeadGesture.SHAKE
            }
            first = second
        }
        return null
    }

    private fun shakeFault(first: Stroke, second: Stroke, nowMs: Double): Rejected? = when {
        second.closedBy != ClosedBy.REVERSAL -> Rejected.TWO_STROKES
        first.peak < config.minPeakRadS || second.peak < config.minPeakRadS -> Rejected.PEAK
        nowMs - first.startMs > config.maxShakeMs -> Rejected.TIME
        span(first.startMs) { it.pitch } > max(first.amp, second.amp) / config.dominance -> Rejected.DOMINANCE
        else -> null
    }

    private fun report(gesture: HeadGesture, first: Stroke, second: Stroke, nowMs: Double, angle: Double, fault: Rejected?) {
        val otherAxis = span(first.startMs) { if (gesture == HeadGesture.NOD) it.yaw else it.pitch }
        onReport(
            GestureReport(gesture, fault, first.amp, second.amp, first.peak, second.peak, (nowMs - first.startMs).roundToLong(), abs(angle - first.startAngle), otherAxis)
        )
    }

    /** The range of one angle from `fromMs` to now. */
    private fun span(fromMs: Double, angle: (AnglePoint) -> Double): Double {
        var low = Double.MAX_VALUE
        var high = -Double.MAX_VALUE
        for (point in angles) {
            if (point.tMs < fromMs) continue
            val value = angle(point)
            if (value < low) low = value
            if (value > high) high = value
        }
        return if (high < low) 0.0 else high - low
    }

    private companion object {
        const val NS_PER_MS = 1_000_000.0
        const val MS_PER_S = 1000.0
        const val DEFAULT_STEP_S = 1.0 / 30
        const val ANGLE_HISTORY_MS = 4000.0

        /** The second stroke of a nod must bring the head back to this part of the largest stroke, or less. */
        const val RETURN_RATIO = 0.4
    }
}
