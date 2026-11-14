package com.metaglance.core.audio

import com.metaglance.core.contract.Lang
import com.metaglance.core.contract.Priority
import com.metaglance.core.contract.ServerToDevice
import com.metaglance.core.contract.SoundName
import com.metaglance.core.contract.Timing

/**
 * One line for the player. With `phoneVoice`, the player speaks `text` with the voice of the phone and reads no clip.
 * `rate` is the speech rate of the profile.
 */
data class PlayableLine(
    val id: String,
    val sound: SoundName?,
    val url: String?,
    val text: String,
    val lang: Lang,
    val rate: Double,
    val phoneVoice: Boolean
)

interface LinePlayer {
    /** `onEnd` runs one time: at the end of the audio, or after a failure. */
    fun play(line: PlayableLine, onEnd: () -> Unit)

    /** Stops the line. The `onEnd` of the stopped line must not run. */
    fun stop()
}

/**
 * Plays the lines of the server one at a time, and reports each prompt that ended.
 * `soundOff` is true when the shopper cannot hear a line, for example with the media volume at 0.
 * Call each function, and each `onEnd` of the player, on one thread.
 */
class SpeechQueue(
    private val player: LinePlayer,
    private val soundOff: () -> Boolean,
    private val rate: () -> Double,
    private val nowMs: () -> Long,
    private val onPromptDone: (String) -> Unit
) {
    private class Line(val playable: PlayableLine, val priority: Priority, val promptId: String?)

    private val waiting = ArrayList<Line>()
    private var current: Line? = null
    private var lastEndMs: Long? = null

    /** A line with `interrupt` stops the current line and drops each waiting line. Another line waits for its turn. */
    fun onSpeak(speak: ServerToDevice.Speak) {
        // With no clip, the phone reads the text with its own voice, so a failure of the speech service is not silent.
        val playable = PlayableLine(speak.id, speak.sound, speak.url, speak.text, speak.lang, rate(), phoneVoice = speak.url == null)
        add(Line(playable, speak.priority, speak.promptId), speak.interrupt)
    }

    /** Speaks a line of the app itself with the phone voice. It interrupts. The text is English. */
    fun sayLocal(text: String) {
        val playable = PlayableLine(LOCAL_LINE_ID, null, null, text, Lang.EN, rate(), phoneVoice = true)
        add(Line(playable, Priority.HIGH, null), interrupt = true)
    }

    /** Stops the current line and drops each waiting line. No prompt of these lines is reported. */
    fun clear() {
        stopCurrent()
        waiting.clear()
    }

    /**
     * True while a line plays, and for `Timing.speechMuteAfterClipMs` after it.
     * The microphone of the glasses hears each line, so speech input in this time is not from the shopper.
     */
    fun isMuted(nowMs: Long): Boolean {
        if (current != null) return true
        val end = lastEndMs ?: return false
        return nowMs - end < Timing.speechMuteAfterClipMs
    }

    private fun add(line: Line, interrupt: Boolean) {
        if (interrupt) clear()
        waiting.add(line)
        if (current == null) startNext()
    }

    private fun stopCurrent() {
        if (current == null) return
        current = null
        lastEndMs = nowMs()
        player.stop()
    }

    private fun startNext() {
        while (current == null) {
            // minByOrNull returns the first of equal lines, so lines of one priority keep their arrival order.
            val next = waiting.minByOrNull { rank(it.priority) } ?: return
            waiting.remove(next)
            if (soundOff()) {
                next.promptId?.let(onPromptDone)
                continue
            }
            current = next
            player.play(next.playable) { onLineEnd(next) }
        }
    }

    private fun onLineEnd(line: Line) {
        if (current !== line) return
        current = null
        lastEndMs = nowMs()
        line.promptId?.let(onPromptDone)
        startNext()
    }

    private fun rank(priority: Priority): Int = when (priority) {
        Priority.HIGH -> 0
        Priority.NORMAL -> 1
        Priority.LOW -> 2
    }

    private companion object {
        const val LOCAL_LINE_ID = "local"
    }
}
