package com.metaglance.core.gesture

/** One gyroscope reading in rad/s. `tNs` is on the clock of the glasses. */
data class GyroSample(val tNs: Long, val x: Float, val y: Float, val z: Float)

/** One accelerometer reading in m/s2. It holds gravity: glasses at rest read 9.81 on the axis to the sky. */
data class AccelSample(val x: Float, val y: Float, val z: Float)

/** One motion sample for the head gestures. `accel` is null when the glasses sent no accelerometer reading. */
data class HeadSample(val gyro: GyroSample, val accel: AccelSample?)
