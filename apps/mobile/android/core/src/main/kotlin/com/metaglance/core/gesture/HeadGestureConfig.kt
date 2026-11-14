package com.metaglance.core.gesture

enum class HeadGesture { NOD, SHAKE }

enum class Sensitivity { GENTLE, NORMAL, FIRM }

/**
 * The limits of the head gesture detector. Angles are in rad, rates are in rad/s.
 *
 * `pitchAxis` and `yawAxis` are the gyroscope axes of a nod and of a shake. `pitchDownSign` is 1 or -1: the sign
 * of the rate on `pitchAxis` when the head moves down. A sample with an accelerometer reading needs the yaw axis
 * and the sign not at all, and the pitch axis only as the axis from ear to ear: see `HeadAxes`.
 *
 * - `minStrokeRad`, `minPeakRadS`: the smallest stroke and the smallest top rate of a gesture.
 * - `maxNodRad`: a nod has no stroke larger than this.
 * - `maxNodMs`: the longest time from the start of the first stroke of a nod to the report.
 * - `maxShakeMs`: the longest time from the start of a shake to the start of its third stroke.
 * - `holdMs`, `settleRadS`: a stroke ends when the rate stays below `settleRadS` for `holdMs`. A turn between two
 *   strokes that takes longer splits the pair, so these two values set the slowest gesture.
 * - `restRadS`: below this rate the head is at rest, and the start of the next stroke follows it.
 * - `dominance`: the gesture axis must move this many times more than the other axis.
 * - `refractoryMs`: the time after a gesture with no new gesture. The head must also be quiet before the next one.
 * - `gapResetMs`: a longer step between the times of two samples resets the detector.
 *
 * The head studies give these values for a person who answers: a nod of 17 degrees (0.30 rad) at 59 degrees each
 * second, and a shake of 26 degrees (0.45 rad) at 84 degrees each second. A person who walks moves the head at
 * 17 degrees each second (0.30 rad/s) at most, in a bob of 2 Hz. Nobody measured them with these glasses.
 */
data class HeadGestureConfig(
    val pitchAxis: Axis,
    val pitchDownSign: Int,
    val yawAxis: Axis,
    val minStrokeRad: Float,
    val minPeakRadS: Float,
    val maxNodRad: Float = 0.6f,
    val maxNodMs: Long = 1500,
    val maxShakeMs: Long = 2500,
    val holdMs: Long = 250,
    val settleRadS: Float = 0.3f,
    val restRadS: Float = 0.15f,
    val dominance: Float = 2.0f,
    val refractoryMs: Long = 600,
    val gapResetMs: Long = 200
) {
    init {
        require(pitchDownSign == 1 || pitchDownSign == -1) { "pitchDownSign is 1 or -1. This value is $pitchDownSign." }
        require(pitchAxis != yawAxis) { "The pitch axis and the yaw axis are both $pitchAxis." }
    }

    companion object {
        fun of(level: Sensitivity, pitchAxis: Axis, pitchDownSign: Int, yawAxis: Axis): HeadGestureConfig = when (level) {
            Sensitivity.GENTLE -> HeadGestureConfig(pitchAxis, pitchDownSign, yawAxis, minStrokeRad = 0.07f, minPeakRadS = 0.6f)
            Sensitivity.NORMAL -> HeadGestureConfig(pitchAxis, pitchDownSign, yawAxis, minStrokeRad = 0.10f, minPeakRadS = 0.8f)
            Sensitivity.FIRM -> HeadGestureConfig(pitchAxis, pitchDownSign, yawAxis, minStrokeRad = 0.16f, minPeakRadS = 1.2f)
        }
    }
}
