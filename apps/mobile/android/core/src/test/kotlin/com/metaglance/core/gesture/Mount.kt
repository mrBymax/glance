package com.metaglance.core.gesture

import kotlin.math.sqrt

/**
 * Puts the head movements of a [GyroScript] into the frame of glasses that sit on the head in a given way.
 * `lateral` is the axis from ear to ear, and `up` is the axis to the sky, both in the frame of the glasses at the
 * start. A pitch turns the head about `lateral`, and a yaw turns it about the vertical of the room.
 * The accelerometer reads gravity, which moves in the frame of the glasses when the head moves.
 */
class Mount(lateral: List<Double>, up: List<Double>) {
    private val lateral = unit(lateral)
    private val startUp = unit(up)

    /** The script must use the config [SCRIPT]: the pitch rate on x, the yaw rate on y. */
    fun samples(script: GyroScript): List<HeadSample> {
        var up = startUp
        var lastNs: Long? = null
        return script.samples().map { s ->
            val w = List(3) { i -> s.x * lateral[i] + s.y * up[i] }
            val dt = lastNs?.let { (s.tNs - it) / 1e9 } ?: 0.0
            lastNs = s.tNs
            // A vector that is fixed in the room turns against the glasses: du/dt = u x w.
            val turn = cross(up, w)
            up = unit(List(3) { i -> up[i] + turn[i] * dt })
            HeadSample(
                GyroSample(s.tNs, w[0].toFloat(), w[1].toFloat(), w[2].toFloat()),
                AccelSample((G * up[0]).toFloat(), (G * up[1]).toFloat(), (G * up[2]).toFloat())
            )
        }
    }

    companion object {
        const val G = 9.81

        /** The config of each script for [samples]. */
        val SCRIPT = HeadGestureConfig.of(Sensitivity.NORMAL, Axis.X, 1, Axis.Y)

        private fun unit(v: List<Double>): List<Double> {
            val n = sqrt(v.sumOf { it * it })
            return v.map { it / n }
        }

        private fun cross(a: List<Double>, b: List<Double>) = listOf(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])
    }
}
