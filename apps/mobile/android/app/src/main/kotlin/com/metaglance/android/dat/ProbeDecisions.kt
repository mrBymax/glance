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
    val PITCH_AXIS = Axis.X

    /** The sign of the pitch rate when the head starts to move down. */
    const val PITCH_DOWN_SIGN = 1
    val YAW_AXIS = Axis.Y
    const val MOTION_NEEDS_STREAM = true

    /** True if a line must play on the phone speaker, because a line in the glasses disturbs the stream. */
    const val AUDIO_ON_PHONE = false
}
