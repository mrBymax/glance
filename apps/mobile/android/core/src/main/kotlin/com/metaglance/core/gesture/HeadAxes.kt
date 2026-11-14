package com.metaglance.core.gesture

import kotlin.math.min
import kotlin.math.sqrt

/**
 * Gives the pitch rate and the yaw rate of the head from one motion sample, with no calibration.
 *
 * The accelerometer reads gravity, so its slow part points to the sky. The yaw rate is the part of the gyroscope
 * rate about that direction. The pitch rate is the rate about the ear axis: the pitch axis of the config, laid
 * level. So a wrong yaw axis in the config, or a head that leans, cannot turn a shake into a nod.
 *
 * When the pitch axis of the config points to the sky, the axis map is wrong, and the ear axis is not known.
 * The pitch rate is then the rate about the level axis of the movement itself. That axis is set when a movement
 * starts from rest, so a movement to the shoulder also counts as a pitch in this case.
 *
 * A sample with no accelerometer reading uses the two axes of the config.
 */
class HeadAxes(private val config: HeadGestureConfig) {
    /** `pitch` and `yaw` are in rad/s. The sign of `pitch` is free when the ear axis is not known. */
    class Rates(val pitch: Double, val yaw: Double)

    private class Vec(val x: Double, val y: Double, val z: Double) {
        val length: Double get() = sqrt(dot(this))

        fun dot(o: Vec) = x * o.x + y * o.y + z * o.z

        fun cross(o: Vec) = Vec(y * o.z - z * o.y, z * o.x - x * o.z, x * o.y - y * o.x)

        fun plus(o: Vec, scale: Double) = Vec(x + o.x * scale, y + o.y * scale, z + o.z * scale)

        fun unit(): Vec = length.let { Vec(x / it, y / it, z / it) }
    }

    /** The direction to the sky in the frame of the glasses. null before the first accelerometer reading. */
    private var up: Vec? = null

    /** The level axis of the movement that runs now. Only for an axis map with the pitch axis to the sky. */
    private var moveAxis: Vec? = null
    private var restS = 0.0

    fun reset() {
        up = null
        moveAxis = null
        restS = 0.0
    }

    /** `dtS` is the time since the sample before this one, in seconds. */
    fun rates(sample: HeadSample, dtS: Double): Rates {
        val w = Vec(sample.gyro.x.toDouble(), sample.gyro.y.toDouble(), sample.gyro.z.toDouble())
        val gravity = sample.accel?.let { Vec(it.x.toDouble(), it.y.toDouble(), it.z.toDouble()) }?.takeIf { it.length >= MIN_GRAVITY }
        if (gravity == null) {
            reset()
            return Rates((sample.gyro.on(config.pitchAxis) * config.pitchDownSign).toDouble(), sample.gyro.on(config.yawAxis).toDouble())
        }
        val sky = track(gravity.unit(), w, dtS)
        val yaw = w.dot(sky)
        val level = w.plus(sky, -yaw)
        val ear = axis(config.pitchAxis).let { it.plus(sky, -it.dot(sky)) }
        if (ear.length >= MIN_EAR_AXIS) return Rates(level.dot(ear.unit()) * config.pitchDownSign, yaw)
        return Rates(aboutMoveAxis(level, dtS), yaw)
    }

    /**
     * Follows the direction to the sky. The gyroscope turns it at once, and the accelerometer pulls it to the
     * measured gravity with the time constant [GRAVITY_S], so a step of a walk does not move it.
     */
    private fun track(measured: Vec, w: Vec, dtS: Double): Vec {
        val before = up ?: measured
        // A direction that is fixed in the room turns against the glasses: du/dt = u x w.
        val turned = before.plus(before.cross(w), dtS)
        val pull = min(1.0, dtS / GRAVITY_S)
        return turned.plus(measured.plus(turned, -1.0), pull).unit().also { up = it }
    }

    private fun aboutMoveAxis(level: Vec, dtS: Double): Double {
        val rate = level.length
        restS = if (rate < config.restRadS) restS + dtS else 0.0
        if (restS >= MOVE_AXIS_REST_S) moveAxis = null
        val axis = moveAxis ?: if (rate >= config.restRadS) level.unit().also { moveAxis = it } else return 0.0
        return level.dot(axis)
    }

    private fun axis(axis: Axis) = when (axis) {
        Axis.X -> Vec(1.0, 0.0, 0.0)
        Axis.Y -> Vec(0.0, 1.0, 0.0)
        Axis.Z -> Vec(0.0, 0.0, 1.0)
    }

    private companion object {
        /** A smaller reading is no reading: a motion file has 0 for a sensor that sent nothing. Only the direction counts, so the unit does not matter. */
        const val MIN_GRAVITY = 0.5
        const val GRAVITY_S = 1.0

        /** The pitch axis of the config, laid level, has at least this length when it is the ear axis: 60 degrees from the sky. */
        const val MIN_EAR_AXIS = 0.5
        const val MOVE_AXIS_REST_S = 0.3
    }
}
