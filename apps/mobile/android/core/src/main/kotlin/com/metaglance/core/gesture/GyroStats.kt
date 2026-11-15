package com.metaglance.core.gesture

import kotlin.math.abs
import kotlin.math.sqrt

enum class Axis { X, Y, Z }

/** `firstSign` is 1, -1, or 0. The RMS values are in rad/s. */
class AxisReport(val rmsX: Float, val rmsY: Float, val rmsZ: Float, val strongest: Axis, val firstSign: Int)

/** Finds the axis of a head movement in a recording. The probe uses it to name the pitch axis and the yaw axis. */
object GyroStats {
    /**
     * `strongest` is the axis with the largest RMS rate. `firstSign` is the sign of the first sample on that axis
     * whose size is `startRadS` or more, and 0 if there is none.
     */
    fun report(samples: List<GyroSample>, startRadS: Float = 0.8f): AxisReport {
        val rmsX = rms(samples) { it.x }
        val rmsY = rms(samples) { it.y }
        val rmsZ = rms(samples) { it.z }
        val strongest = when {
            rmsX >= rmsY && rmsX >= rmsZ -> Axis.X
            rmsY >= rmsZ -> Axis.Y
            else -> Axis.Z
        }
        val first = samples.map { it.on(strongest) }.firstOrNull { abs(it) >= startRadS }
        val firstSign = when {
            first == null -> 0
            first > 0 -> 1
            else -> -1
        }
        return AxisReport(rmsX, rmsY, rmsZ, strongest, firstSign)
    }

    private fun rms(samples: List<GyroSample>, value: (GyroSample) -> Float): Float {
        if (samples.isEmpty()) return 0f
        return sqrt(samples.sumOf { value(it).toDouble() * value(it) } / samples.size).toFloat()
    }
}

fun GyroSample.on(axis: Axis): Float = when (axis) {
    Axis.X -> x
    Axis.Y -> y
    Axis.Z -> z
}
