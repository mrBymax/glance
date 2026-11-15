package com.metaglance.core.audio

import com.metaglance.core.contract.SoundName

/**
 * One sound for one answer. The app plays the answer sound of a head gesture at once, and the line of the server
 * that answers the gesture carries the same sound: `added` with "Added", `removed` with "Removed". Without this
 * rule the shopper hears the sound two times.
 *
 * The next line after an answer sound loses its sound when the sound is the same and the line arrives less than
 * [WITHIN_MS] later. The clip of the line still plays. Another sound stays: the add that crosses the budget has
 * the sound `warning`. Call each function on one thread.
 */
class AnswerSoundOnce {
    private var played: SoundName? = null
    private var playedMs = 0L

    /** The app played this sound by itself, for an answer that it sent. */
    fun onAnswerSound(sound: SoundName, nowMs: Long) {
        played = sound
        playedMs = nowMs
    }

    /** A line of the server arrived with this sound. Returns the sound that the line plays, or null for none. */
    fun lineSound(sound: SoundName?, nowMs: Long): SoundName? {
        val answer = played
        played = null
        return if (sound != null && sound == answer && nowMs - playedMs < WITHIN_MS) null else sound
    }

    companion object {
        const val WITHIN_MS = 3000L
    }
}
