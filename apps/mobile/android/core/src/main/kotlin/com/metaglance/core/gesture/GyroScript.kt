package com.metaglance.core.gesture

import kotlin.math.PI
import kotlin.math.floor
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * Builds gyroscope samples of head movements at 30 Hz, from the time 0. The tests and the mock menu use it.
 * A pitch angle is positive for down. Each movement is one half sine wave of the rate, so its angle is exact.
 */
class GyroScript(private val config: HeadGestureConfig) {
    private class Rates(val pitch: Double, val yaw: Double)

    private val rates = ArrayList<Rates>()
    private var walk = false
    private var lastMoveIndex = 0

    /** The time of the last sample of the last movement, in ms. */
    val lastMoveMs: Long get() = timeNs(lastMoveIndex) / 1_000_000

    fun rest(ms: Int): GyroScript {
        repeat((ms / STEP_MS).roundToInt()) { rates.add(Rates(0.0, 0.0)) }
        return this
    }

    fun pitch(angleRad: Double, ms: Int): GyroScript = both(angleRad, 0.0, ms)

    fun yaw(angleRad: Double, ms: Int): GyroScript = both(0.0, angleRad, ms)

    /** The same movement on both axes. */
    fun diagonal(angleRad: Double, ms: Int): GyroScript = both(angleRad, angleRad, ms)

    /** One movement with an angle of its own on each axis, for example a shake that also moves the pitch. */
    fun both(pitchRad: Double, yawRad: Double, ms: Int): GyroScript {
        val count = (ms / STEP_MS).roundToInt()
        for (i in 0 until count) {
            val shape = PI / (2 * ms / 1000.0) * sin(PI * (i + 0.5) * STEP_MS / ms)
            rates.add(Rates(pitchRad * shape, yawRad * shape))
        }
        if (count > 0) lastMoveIndex = rates.size - 1
        return this
    }

    /** Adds the head movement of a walk to each sample: a sway on both axes and a step impact each 500 ms. */
    fun withWalk(): GyroScript {
        walk = true
        return this
    }

    fun samples(): List<GyroSample> = rates.mapIndexed { i, rate ->
        var pitch = rate.pitch
        var yaw = rate.yaw
        if (walk) {
            val tMs = i * STEP_MS
            pitch += 0.3 * sin(2 * PI * 2 * tMs / 1000)
            yaw += 0.25 * sin(2 * PI * tMs / 1000 + 1)
            val block = floor(tMs / WALK_STEP_MS).toInt()
            val firstOfBlock = i == 0 || floor((i - 1) * STEP_MS / WALK_STEP_MS).toInt() != block
            if (firstOfBlock) pitch += if (block % 2 == 0) 1.0 else -1.0
        }
        sample(timeNs(i), pitch * config.pitchDownSign, yaw)
    }

    /** The samples as rows of a motion file: the gyroscope values, gravity on the y axis, and no rotation. */
    fun rows(): List<MotionRow> = samples().map {
        MotionRow(it.tNs, 0f, 9.81f, 0f, it.x, it.y, it.z, 0f, 0f, 0f, 1f, 0f, 0f, 0f)
    }

    private fun sample(tNs: Long, pitchRate: Double, yawRate: Double): GyroSample {
        fun on(axis: Axis) = when (axis) {
            config.pitchAxis -> pitchRate.toFloat()
            config.yawAxis -> yawRate.toFloat()
            else -> 0f
        }
        return GyroSample(tNs, on(Axis.X), on(Axis.Y), on(Axis.Z))
    }

    private fun timeNs(index: Int): Long = index * 1_000_000_000L / SAMPLES_PER_SECOND

    private companion object {
        const val SAMPLES_PER_SECOND = 30
        const val STEP_MS = 1000.0 / SAMPLES_PER_SECOND
        const val WALK_STEP_MS = 500.0
    }
}
