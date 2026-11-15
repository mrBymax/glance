package com.metaglance.core.audio

import com.metaglance.core.contract.SoundName
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AnswerSoundOnceTest {
    private val once = AnswerSoundOnce()

    @Test fun `the next line loses the sound that the app played for the answer`() {
        once.onAnswerSound(SoundName.ADDED, 1000)
        assertNull(once.lineSound(SoundName.ADDED, 1400))
    }

    @Test fun `a line keeps its sound when the app played no answer sound`() {
        assertEquals(SoundName.ADDED, once.lineSound(SoundName.ADDED, 1400))
        assertNull(once.lineSound(null, 1500))
    }

    @Test fun `a line keeps another sound`() {
        once.onAnswerSound(SoundName.ADDED, 1000)
        assertEquals(SoundName.WARNING, once.lineSound(SoundName.WARNING, 1400))
    }

    @Test fun `a line that arrives 3 seconds after the answer sound keeps its sound`() {
        once.onAnswerSound(SoundName.REMOVED, 1000)
        assertEquals(SoundName.REMOVED, once.lineSound(SoundName.REMOVED, 1000 + AnswerSoundOnce.WITHIN_MS))
    }

    @Test fun `a line just inside 3 seconds loses the sound`() {
        once.onAnswerSound(SoundName.REMOVED, 1000)
        assertNull(once.lineSound(SoundName.REMOVED, 999 + AnswerSoundOnce.WITHIN_MS))
    }

    @Test fun `one answer sound takes the sound of one line`() {
        once.onAnswerSound(SoundName.ADDED, 1000)
        assertNull(once.lineSound(SoundName.ADDED, 1400))
        assertEquals(SoundName.ADDED, once.lineSound(SoundName.ADDED, 1800))
    }

    @Test fun `only the next line counts`() {
        once.onAnswerSound(SoundName.REMOVED, 1000)
        assertNull(once.lineSound(null, 1300))
        assertEquals(SoundName.REMOVED, once.lineSound(SoundName.REMOVED, 1600))
    }

    @Test fun `a second answer sound replaces the first`() {
        once.onAnswerSound(SoundName.ADDED, 1000)
        once.onAnswerSound(SoundName.REMOVED, 2000)
        assertEquals(SoundName.ADDED, once.lineSound(SoundName.ADDED, 2400))
    }
}
