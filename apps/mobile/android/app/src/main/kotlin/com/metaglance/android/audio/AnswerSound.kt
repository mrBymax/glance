package com.metaglance.android.audio

import android.content.Context
import android.media.AudioAttributes
import android.media.SoundPool
import com.metaglance.android.R

/**
 * The sound for a head gesture that the app took as an answer. The line of the server comes a moment later,
 * and without this sound the shopper does not know if the nod counted, and nods again.
 *
 * A yes plays the sound `added`, and a no plays the sound `removed`: two sounds of the app that the lines of the
 * server also use. Each one plays as media, so it goes to the glasses when they are the media output, and a
 * media volume of 0 makes it silent. It does not stop a line that plays.
 */
class AnswerSound(context: Context) {
    private val pool = SoundPool.Builder()
        .setMaxStreams(1)
        .setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
        )
        .build()
    private val yesId = pool.load(context.applicationContext, R.raw.added, 1)
    private val noId = pool.load(context.applicationContext, R.raw.removed, 1)

    /** Plays the sound one time. Returns false for a sound that the pool did not load yet: it does not play. */
    fun play(yes: Boolean): Boolean = pool.play(if (yes) yesId else noId, 1f, 1f, 1, 0, 1f) != 0
}
