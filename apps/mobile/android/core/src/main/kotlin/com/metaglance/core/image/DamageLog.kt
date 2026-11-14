package com.metaglance.core.image

/**
 * Counts the damaged frames of the stream (`FrameDamage`), and gives one log line for each `everyMs` that had a
 * damaged frame. A person who compares two stream settings reads these lines.
 */
class DamageLog(private val everyMs: Long = 3000) {
    private var startMs: Long? = null
    private var frames = 0
    private var damagedFrames = 0

    private var totalFrames = 0
    private var totalDamaged = 0

    /** The line for the end of the stream, about all its frames. */
    val totalLine: String get() = "frames damaged total=$totalDamaged of $totalFrames"

    /** Call it for each frame. Returns the line about the frames before this one, when their time is over. */
    fun onFrame(nowMs: Long, damaged: Boolean): String? {
        val start = startMs
        var line: String? = null
        if (start == null || nowMs - start >= everyMs) {
            if (damagedFrames > 0) line = "frames damaged=$damagedFrames of $frames"
            startMs = nowMs
            frames = 0
            damagedFrames = 0
        }
        frames += 1
        totalFrames += 1
        if (damaged) {
            damagedFrames += 1
            totalDamaged += 1
        }
        return line
    }
}
