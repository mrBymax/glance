package com.metaglance.core.gesture

/** One gyroscope reading in rad/s. `tNs` is on the clock of the glasses. */
data class GyroSample(val tNs: Long, val x: Float, val y: Float, val z: Float)
