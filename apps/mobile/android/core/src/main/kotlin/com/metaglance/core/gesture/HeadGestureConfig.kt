package com.metaglance.core.gesture

enum class HeadGesture { NOD, SHAKE }

enum class Sensitivity { GENTLE, NORMAL, FIRM }

/**
 * The limits of the head gesture detector. Angles are in rad, rates are in rad/s.
 * `pitchDownSign` is 1 or -1: the sign of the rate on `pitchAxis` when the head moves down.
 *
 * - `minStrokeRad`, `minPeakRadS`: the smallest stroke and the smallest top rate of a gesture.
 * - `maxNodRad`, `maxNodMs`: a larger or a longer movement down and back is not a nod.
 * - `maxShakeMs`: the longest time for the two strokes of a shake.
 * - `holdMs`, `settleRadS`: a stroke ends when the rate stays below `settleRadS` for `holdMs`.
 * - `restRadS`: below this rate the head is at rest, and the start of the next stroke follows it.
 * - `dominance`: the gesture axis must move this many times more than the other axis.
 * - `refractoryMs`: the time after a gesture with no new gesture.
 * - `gapResetMs`: a longer time between two samples resets the detector.
 */
data class HeadGestureConfig(
    val pitchAxis: Axis,
    val pitchDownSign: Int,
    val yawAxis: Axis,
    val minStrokeRad: Float,
    val minPeakRadS: Float,
    val maxNodRad: Float = 0.6f,
    val maxNodMs: Long = 1200,
    val maxShakeMs: Long = 1500,
    val holdMs: Long = 150,
    val settleRadS: Float = 0.5f,
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
