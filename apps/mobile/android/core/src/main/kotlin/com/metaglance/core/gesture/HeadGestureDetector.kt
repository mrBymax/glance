package com.metaglance.core.gesture

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.sign

/**
 * Finds nods and shakes in gyroscope samples.
 *
 * The detector integrates the rate of the pitch axis and of the yaw axis to an angle, and cuts each angle into strokes.
 * A stroke is a movement in one direction. It ends at a reversal, or when the head is quiet for `holdMs`.
 * A nod is a stroke down and a stroke back up to the start, then quiet. So a bend to a low shelf is not a nod.
 * A shake is two strokes to opposite sides, each closed by a reversal.
 */
class HeadGestureDetector(private val config: HeadGestureConfig) {
    private enum class ClosedBy { REVERSAL, SETTLE }

    private class Stroke(
        val dir: Int,
        val amp: Double,
        val peak: Double,
        val startMs: Double,
        val endMs: Double,
        val closedBy: ClosedBy
    )

    private class AnglePoint(val tMs: Double, val pitch: Double, val yaw: Double)

    private inner class AxisTracker {
        var angle = 0.0
        var lastStroke: Stroke? = null
        private var anchor = 0.0
        private var anchorMs = 0.0
        private var extreme = 0.0
        private var extremeMs = 0.0
        private var dir = 0
        private var peak = 0.0
        private var quietSinceMs: Double? = null

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
                peak = max(peak, abs(w))
                val d = angle - extreme
                if (d == 0.0 || sign(d).toInt() == dir) {
                    extreme = angle
                    extremeMs = tMs
                } else if (abs(d) >= config.minStrokeRad) {
                    closed.add(Stroke(dir, abs(extreme - anchor), peak, anchorMs, extremeMs, ClosedBy.REVERSAL))
                    anchor = extreme
                    anchorMs = extremeMs
                    dir = -dir
                    extreme = angle
                    extremeMs = tMs
                    peak = abs(w)
                }
            }
            val quietSince = if (abs(w) < config.settleRadS) quietSinceMs ?: tMs else null
            quietSinceMs = quietSince
            if (dir != 0 && quietSince != null && tMs - quietSince >= config.holdMs) {
                closed.add(Stroke(dir, abs(angle - anchor), peak, anchorMs, tMs, ClosedBy.SETTLE))
                anchor = angle
                anchorMs = tMs
                dir = 0
                peak = 0.0
            }
            return closed
        }
    }

    private var pitch = AxisTracker()
    private var yaw = AxisTracker()
    private val angles = ArrayDeque<AnglePoint>()
    private var lastSampleMs: Double? = null
    private var quietUntilMs: Double? = null

    /** Returns the gesture that this sample completes, or null. */
    fun onSample(sample: GyroSample): HeadGesture? {
        val tMs = sample.tNs / NS_PER_MS
        val last = lastSampleMs
        var dtS = if (last == null) 0.0 else (tMs - last) / MS_PER_S
        if (last == null || dtS <= 0.0 || dtS * MS_PER_S > config.gapResetMs) {
            reset()
            dtS = DEFAULT_STEP_S
        }
        lastSampleMs = tMs

        val pitchStrokes = pitch.step(tMs, (sample.on(config.pitchAxis) * config.pitchDownSign).toDouble(), dtS)
        val yawStrokes = yaw.step(tMs, sample.on(config.yawAxis).toDouble(), dtS)
        angles.addLast(AnglePoint(tMs, pitch.angle, yaw.angle))
        while (angles.first().tMs < tMs - ANGLE_HISTORY_MS) angles.removeFirst()

        var gesture: HeadGesture? = null
        for (stroke in pitchStrokes) {
            if (isNod(pitch.lastStroke, stroke)) gesture = HeadGesture.NOD
            pitch.lastStroke = stroke
        }
        for (stroke in yawStrokes) {
            if (gesture == null && isShake(yaw.lastStroke, stroke, tMs)) gesture = HeadGesture.SHAKE
            yaw.lastStroke = stroke
        }

        val quietUntil = quietUntilMs
        if (gesture == null || (quietUntil != null && tMs < quietUntil)) return null
        quietUntilMs = tMs + config.refractoryMs
        return gesture
    }

    /** Forgets each stroke and each angle. The next sample starts from rest. */
    fun reset() {
        pitch = AxisTracker()
        yaw = AxisTracker()
        angles.clear()
        lastSampleMs = null
        quietUntilMs = null
    }

    private fun isNod(down: Stroke?, up: Stroke): Boolean {
        if (down == null || up.closedBy != ClosedBy.SETTLE || down.endMs != up.startMs) return false
        return down.dir == 1 &&
            up.dir == -1 &&
            down.amp >= config.minStrokeRad &&
            down.amp <= config.maxNodRad &&
            down.peak >= config.minPeakRadS &&
            abs(up.amp - down.amp) <= max(RETURN_SLACK_RAD, RETURN_SLACK_RATIO * down.amp) &&
            up.endMs - down.startMs <= config.maxNodMs + config.holdMs &&
            span(down.startMs) { it.yaw } <= down.amp / config.dominance
    }

    private fun isShake(first: Stroke?, second: Stroke, nowMs: Double): Boolean {
        if (first == null || second.closedBy != ClosedBy.REVERSAL || first.endMs != second.startMs) return false
        return first.dir == -second.dir &&
            first.amp >= config.minStrokeRad &&
            second.amp >= config.minStrokeRad &&
            first.peak >= config.minPeakRadS &&
            second.peak >= config.minPeakRadS &&
            nowMs - first.startMs <= config.maxShakeMs &&
            span(first.startMs) { it.pitch } <= max(first.amp, second.amp) / config.dominance
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
        const val ANGLE_HISTORY_MS = 2500.0

        // The stroke back up of a nod can differ from the stroke down by the larger of these two.
        const val RETURN_SLACK_RAD = 0.06
        const val RETURN_SLACK_RATIO = 0.35
    }
}
