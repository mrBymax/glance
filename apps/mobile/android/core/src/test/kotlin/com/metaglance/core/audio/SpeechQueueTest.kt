package com.metaglance.core.audio

import com.metaglance.core.contract.Lang
import com.metaglance.core.contract.Priority
import com.metaglance.core.contract.ServerToDevice
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SpeechQueueTest {
    private class FakePlayer : LinePlayer {
        val lines = ArrayList<PlayableLine>()
        var stopCount = 0
        private var pending: (() -> Unit)? = null

        override fun play(line: PlayableLine, onEnd: () -> Unit) {
            lines.add(line)
            pending = onEnd
        }

        override fun stop() {
            stopCount += 1
            pending = null
        }

        /** The line that plays ends. A clip that fails ends the same way. */
        fun finish() {
            val onEnd = pending
            pending = null
            onEnd?.invoke()
        }
    }

    private val player = FakePlayer()
    private var soundOff = false
    private var speechRate = 1.0
    private var clock = 0L
    private val done = ArrayList<String>()
    private val q = SpeechQueue(player, { soundOff }, { speechRate }, { clock }, { done.add(it) })

    private fun speak(
        id: String,
        priority: Priority = Priority.NORMAL,
        interrupt: Boolean = false,
        promptId: String? = null,
        url: String? = "https://x.test/$id.mp3"
    ) = ServerToDevice.Speak(id, priority, "text $id", Lang.EN, url, null, interrupt, promptId)

    private val played get() = player.lines.map { it.id }

    @Test fun `plays one line at a time in arrival order`() {
        q.onSpeak(speak("a"))
        q.onSpeak(speak("b"))
        assertEquals(listOf("a"), played)
        player.finish()
        assertEquals(listOf("a", "b"), played)
    }

    @Test fun `a line with interrupt stops the current line and drops the waiting lines`() {
        q.onSpeak(speak("a"))
        q.onSpeak(speak("b"))
        q.onSpeak(speak("c", interrupt = true))
        assertEquals(1, player.stopCount)
        assertEquals(listOf("a", "c"), played)
        player.finish()
        assertEquals(listOf("a", "c"), played)
    }

    @Test fun `a higher priority waits in front of a lower priority`() {
        q.onSpeak(speak("a"))
        q.onSpeak(speak("low", Priority.LOW))
        q.onSpeak(speak("high", Priority.HIGH))
        q.onSpeak(speak("normal"))
        repeat(3) { player.finish() }
        assertEquals(listOf("a", "high", "normal", "low"), played)
    }

    @Test fun `reports a prompt one time when its clip ends`() {
        q.onSpeak(speak("p", promptId = "p-0001"))
        assertEquals(emptyList<String>(), done)
        player.finish()
        player.finish()
        assertEquals(listOf("p-0001"), done)
    }

    @Test fun `does not report a prompt that was interrupted or dropped`() {
        q.onSpeak(speak("p", promptId = "p-0001"))
        q.onSpeak(speak("w", promptId = "p-0002"))
        q.onSpeak(speak("c", interrupt = true))
        player.finish()
        assertEquals(emptyList<String>(), done)
    }

    @Test fun `a line with no clip uses the phone voice and reports its prompt at the end`() {
        q.onSpeak(speak("n", promptId = "p-0003", url = null))
        assertTrue(player.lines.single().phoneVoice)
        assertEquals(emptyList<String>(), done)
        player.finish()
        assertEquals(listOf("p-0003"), done)
    }

    // Review Focus 1. The player calls onEnd after a failure too.
    @Test fun `a clip that fails still ends the line and reports the prompt`() {
        q.onSpeak(speak("bad", promptId = "p-0004"))
        q.onSpeak(speak("next"))
        assertFalse(player.lines.first().phoneVoice)
        player.finish()
        assertEquals(listOf("p-0004"), done)
        assertEquals(listOf("bad", "next"), played)
    }

    @Test fun `with sound off a prompt is reported at once and nothing plays`() {
        soundOff = true
        q.onSpeak(speak("s", promptId = "p-0005"))
        assertEquals(emptyList<String>(), played)
        assertEquals(listOf("p-0005"), done)
        assertFalse(q.isMuted(clock))
    }

    @Test fun `with sound off at the end of a line the waiting prompts are reported in order`() {
        q.onSpeak(speak("a"))
        q.onSpeak(speak("low", Priority.LOW, promptId = "p-0006"))
        q.onSpeak(speak("high", Priority.HIGH, promptId = "p-0007"))
        soundOff = true
        player.finish()
        assertEquals(listOf("a"), played)
        assertEquals(listOf("p-0007", "p-0006"), done)
    }

    @Test fun `is muted while a line plays and for 500 ms after it`() {
        assertFalse(q.isMuted(0))
        clock = 1000
        q.onSpeak(speak("a"))
        assertTrue(q.isMuted(1000))
        clock = 3000
        player.finish()
        assertTrue(q.isMuted(3499))
        assertFalse(q.isMuted(3500))
    }

    @Test fun `a local line interrupts and uses the phone voice`() {
        q.onSpeak(speak("a"))
        q.sayLocal("Connection lost. Your cart is safe. Glances are paused.")
        assertEquals(1, player.stopCount)
        assertTrue(player.lines.last().phoneVoice)
        assertEquals("Connection lost. Your cart is safe. Glances are paused.", player.lines.last().text)
    }

    @Test fun `gives each line the speech rate of the profile`() {
        speechRate = 1.5
        q.onSpeak(speak("a"))
        assertEquals(1.5, player.lines.single().rate, 0.0)
    }

    @Test fun `clear stops the line, drops each waiting line, and reports no prompt`() {
        q.onSpeak(speak("p", promptId = "p-0008"))
        q.onSpeak(speak("w", promptId = "p-0009"))
        clock = 2000
        q.clear()
        player.finish()
        assertEquals(1, player.stopCount)
        assertEquals(listOf("p"), played)
        assertEquals(emptyList<String>(), done)
        assertTrue(q.isMuted(2499))
        assertFalse(q.isMuted(2500))
    }
}
