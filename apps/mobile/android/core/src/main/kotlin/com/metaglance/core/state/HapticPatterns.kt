package com.metaglance.core.state

/** The name of each vibration of the app. `HapticRules` selects one for an event or for a change of the camera. */
enum class HapticPattern { PROMPT, ADDED, REMOVED, WARNING, PAID, ERROR, CAMERA_PAUSED, CAMERA_OFF }

/** The vibration of each haptic pattern. */
object HapticPatterns {
    /** The timings in ms: a pause, a vibration, a pause, a vibration, and so on. The first pause is 0. */
    fun timings(pattern: HapticPattern): LongArray = when (pattern) {
        HapticPattern.PROMPT -> longArrayOf(0, 40)
        HapticPattern.ADDED -> longArrayOf(0, 40, 80, 40)
        HapticPattern.REMOVED -> longArrayOf(0, 200)
        HapticPattern.WARNING -> longArrayOf(0, 120, 80, 120, 80, 120)
        HapticPattern.PAID -> longArrayOf(0, 40, 80, 40, 80, 300)
        HapticPattern.ERROR -> longArrayOf(0, 300, 150, 300)
        HapticPattern.CAMERA_PAUSED -> longArrayOf(0, 60, 120, 60, 600, 60, 120, 60, 600, 60, 120, 60)
        HapticPattern.CAMERA_OFF -> longArrayOf(0, 400, 200, 400, 200, 400)
    }
}
