package com.metaglance.android.dat

import com.meta.wearable.dat.inputs.types.InputSource
import com.metaglance.core.gesture.Axis

/**
 * The results of the probe run on the glasses that switch the design (spec section 16).
 * These values are the defaults. The probe run replaces them with the measured values.
 */
object ProbeDecisions {
    const val MOTION = true
    const val INPUTS = true
    const val SPEECH = false
    val INPUT_SOURCES: Set<InputSource> = setOf(InputSource.CAPTOUCH)

    /**
     * The gyroscope axis from ear to ear. Four motion recordings of 2026-11-14 gave this map: the accelerometer
     * reads gravity on -x, so x points to the ground, and each nod is a turn about y.
     */
    val PITCH_AXIS = Axis.Y

    /**
     * The sign of the pitch rate when the head starts to move down. A positive rate about y moves gravity to -z,
     * the reading of a head that looks down, and the fast first stroke of each recorded nod is positive.
     */
    const val PITCH_DOWN_SIGN = 1

    /** The axis to the sky of a level head. It counts only for a sample with no accelerometer reading. */
    val YAW_AXIS = Axis.X
    const val MOTION_NEEDS_STREAM = true

    /** True if a line must play on the phone speaker, because a line in the glasses disturbs the stream. */
    const val AUDIO_ON_PHONE = false
}
