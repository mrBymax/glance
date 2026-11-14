package com.metaglance.android.audio

import android.content.Context
import android.media.AudioAttributes
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.Locale
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * The speech engine of the phone, in US English. It plays as media, so the sound goes to the glasses when they
 * are the media output.
 */
class PhoneVoice(context: Context) {
    /** False until the speech engine of the phone is ready. Also false if the phone has no speech engine. */
    @Volatile
    var ready: Boolean = false
        private set

    private val main = Handler(Looper.getMainLooper())
    private val pending = ConcurrentHashMap<String, () -> Unit>()
    private val tts: TextToSpeech = TextToSpeech(context.applicationContext) { status ->
        // The engine calls this listener after the constructor returns, when its service is connected.
        if (status == TextToSpeech.SUCCESS) main.post { configure() }
    }

    private fun configure() {
        tts.setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build()
        )
        tts.setLanguage(Locale.US)
        tts.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String) = Unit

            override fun onDone(utteranceId: String) = finish(utteranceId)

            // New Android versions call onError(String, Int). The class still needs this override.
            @Suppress("OVERRIDE_DEPRECATION")
            override fun onError(utteranceId: String) = finish(utteranceId)

            override fun onError(utteranceId: String, errorCode: Int) = finish(utteranceId)

            override fun onStop(utteranceId: String, interrupted: Boolean) = finish(utteranceId)
        })
        ready = true
    }

    /**
     * Speaks `text` and drops a line that is still in play. `onEnd` runs one time on the main thread: after the
     * line, after a stop, and after an error. It also runs when the engine is not ready.
     */
    fun speak(text: String, rate: Float = 1f, onEnd: () -> Unit) {
        if (!ready) {
            main.post(onEnd)
            return
        }
        val id = UUID.randomUUID().toString()
        pending[id] = onEnd
        tts.setSpeechRate(rate)
        if (tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, id) != TextToSpeech.SUCCESS) finish(id)
    }

    fun stop() {
        if (ready) tts.stop()
        pending.keys.toList().forEach { finish(it) }
    }

    /** Releases the speech engine. Do not use this object after the call. */
    fun shutdown() {
        stop()
        ready = false
        tts.shutdown()
    }

    private fun finish(id: String) {
        pending.remove(id)?.let { main.post(it) }
    }
}
