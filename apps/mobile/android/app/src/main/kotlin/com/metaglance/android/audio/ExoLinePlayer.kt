package com.metaglance.android.audio

import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import com.metaglance.android.R
import com.metaglance.android.dat.ProbeDecisions
import com.metaglance.core.audio.LinePlayer
import com.metaglance.core.audio.PlayableLine
import com.metaglance.core.contract.SoundName

/**
 * Plays a line as its sound and its speech clip. It plays as media, so the sound goes to the glasses when they
 * are the media output, and to the phone speaker when they are not.
 *
 * A clip that does not load, or that does not start in 3 seconds, is replaced by the voice of the phone.
 * So each line is heard, and each line ends. `clipUrl` gives the address of a clip on the server of the app.
 * Call each function on the main thread.
 */
@OptIn(UnstableApi::class)
class ExoLinePlayer(context: Context, private val voice: PhoneVoice, private val clipUrl: (String) -> String) : LinePlayer {
    /** `clip` is the address of the speech clip, or null for a line that the phone voice speaks. */
    private class Run(val line: PlayableLine, val clip: String?, val onEnd: () -> Unit)

    private val appContext = context.applicationContext
    private val main = Handler(Looper.getMainLooper())
    private var current: Run? = null
    private var watchdog: Runnable? = null

    private val player: ExoPlayer = ExoPlayer.Builder(appContext)
        .setMediaSourceFactory(
            DefaultMediaSourceFactory(
                DefaultDataSource.Factory(
                    appContext,
                    DefaultHttpDataSource.Factory().setConnectTimeoutMs(HTTP_TIMEOUT_MS).setReadTimeoutMs(HTTP_TIMEOUT_MS)
                )
            )
        )
        .setAudioAttributes(AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_SPEECH).build(), true)
        .build()

    init {
        if (ProbeDecisions.AUDIO_ON_PHONE) {
            val outputs = appContext.getSystemService(AudioManager::class.java).getDevices(AudioManager.GET_DEVICES_OUTPUTS)
            player.setPreferredAudioDevice(outputs.firstOrNull { it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER })
        }
        player.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                if (playbackState == Player.STATE_ENDED) current?.let { onPlaylistEnd(it) }
            }

            override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
                val run = current ?: return
                setSpeed(run, mediaItem)
                armWatchdog(run)
            }

            override fun onPlayerError(error: PlaybackException) {
                current?.let { speakInstead(it) }
            }
        })
    }

    override fun play(line: PlayableLine, onEnd: () -> Unit) {
        stop()
        val run = Run(line, if (line.phoneVoice) null else line.url?.let(::clipAddress), onEnd)
        current = run
        val items = ArrayList<MediaItem>()
        line.sound?.let { sound ->
            items.add(MediaItem.Builder().setMediaId(SOUND_ID).setUri(Uri.parse("android.resource://${appContext.packageName}/${rawId(sound)}")).build())
        }
        run.clip?.let { items.add(MediaItem.Builder().setMediaId(CLIP_ID).setUri(it).build()) }
        if (items.isEmpty()) {
            speak(run)
            return
        }
        player.setMediaItems(items)
        setSpeed(run, items.first())
        player.prepare()
        player.play()
        armWatchdog(run)
    }

    override fun stop() {
        current = null
        disarmWatchdog()
        player.stop()
        player.clearMediaItems()
        voice.stop()
    }

    /** Releases the player. Do not use this object after the call. */
    fun release() {
        stop()
        player.release()
    }

    // The speech rate of the profile changes the clip only. A sound keeps its length and its pitch.
    private fun setSpeed(run: Run, item: MediaItem?) {
        val speed = if (item?.mediaId == CLIP_ID) run.line.rate.toFloat().coerceIn(MIN_RATE, MAX_RATE) else 1f
        player.playbackParameters = PlaybackParameters(speed, 1f)
    }

    private fun onPlaylistEnd(run: Run) {
        // A line with no clip has only its sound in the player.
        if (run.clip == null) speak(run) else finish(run)
    }

    // A clip address that is not an address is a clip that does not load: the phone voice speaks the line.
    private fun clipAddress(url: String): String? = try {
        clipUrl(url)
    } catch (e: IllegalArgumentException) {
        Log.w(TAG, "clip address: ${e.message}")
        null
    }

    // Each item of the line gets 3 seconds to start. An item that plays at that time is in order.
    private fun armWatchdog(run: Run) {
        disarmWatchdog()
        val check = Runnable {
            watchdog = null
            if (current === run && !player.isPlaying) speakInstead(run)
        }
        watchdog = check
        main.postDelayed(check, START_TIMEOUT_MS)
    }

    private fun disarmWatchdog() {
        watchdog?.let(main::removeCallbacks)
        watchdog = null
    }

    private fun speakInstead(run: Run) {
        if (current !== run) return
        player.stop()
        player.clearMediaItems()
        speak(run)
    }

    private fun speak(run: Run) {
        disarmWatchdog()
        // PhoneVoice also ends a line at once when the phone has no speech engine. The line then has no sound,
        // and the prompt of the line still ends.
        voice.speak(run.line.text, run.line.rate.toFloat().coerceIn(MIN_RATE, MAX_RATE)) { finish(run) }
    }

    private fun finish(run: Run) {
        if (current !== run) return
        current = null
        disarmWatchdog()
        run.onEnd()
    }

    private fun rawId(sound: SoundName): Int = when (sound) {
        SoundName.FOUND -> R.raw.found
        SoundName.ADDED -> R.raw.added
        SoundName.REMOVED -> R.raw.removed
        SoundName.WARNING -> R.raw.warning
        SoundName.PAID -> R.raw.paid
    }

    private companion object {
        const val TAG = "Glance"
        const val HTTP_TIMEOUT_MS = 3000
        const val START_TIMEOUT_MS = 3000L
        const val MIN_RATE = 0.8f
        const val MAX_RATE = 2.0f
        const val SOUND_ID = "sound"
        const val CLIP_ID = "clip"
    }
}
