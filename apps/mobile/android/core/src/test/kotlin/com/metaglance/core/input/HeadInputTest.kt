package com.metaglance.core.input

import com.metaglance.core.contract.DeviceToServer
import com.metaglance.core.contract.IntentKind
import com.metaglance.core.contract.IntentSource
import com.metaglance.core.contract.Profile
import com.metaglance.core.contract.Profiles
import com.metaglance.core.contract.YesGesture
import com.metaglance.core.gesture.Axis
import com.metaglance.core.gesture.GyroScript
import com.metaglance.core.gesture.HeadGestureConfig
import com.metaglance.core.gesture.HeadGestureDetector
import com.metaglance.core.gesture.Sensitivity
import org.junit.Assert.assertEquals
import org.junit.Test

// Review Focus 2: a nod that starts before the prompt ends, or that answers a replaced prompt, sends nothing.
class HeadInputTest {
    private val config = HeadGestureConfig.of(Sensitivity.NORMAL, Axis.X, 1, Axis.Y)
    private val prompts = PromptTracker()
    private val input = HeadInput(HeadGestureDetector(config), prompts)

    private fun nod() = GyroScript(config).pitch(0.26, 250).pitch(-0.26, 250).rest(600)

    private fun shake() = GyroScript(config).yaw(0.175, 200).yaw(-0.35, 200).yaw(0.35, 200).yaw(-0.175, 200).rest(600)

    /**
     * Gives each sample of a script to the head input, with `nowMs = startMs + sample time`. Returns the intents.
     * With `beforeSampleAt`, it runs `block` before the first sample at or after that time.
     */
    private fun feed(
        script: GyroScript,
        startMs: Long,
        profile: Profile,
        beforeSampleAt: Long? = null,
        block: () -> Unit = {}
    ): List<DeviceToServer.Intent> {
        var blockRan = false
        return script.samples().mapNotNull { sample ->
            val tMs = sample.tNs / 1_000_000
            if (beforeSampleAt != null && !blockRan && tMs >= beforeSampleAt) {
                blockRan = true
                block()
            }
            input.onSample(sample, startMs + tMs, profile)
        }
    }

    @Test fun `a nod inside the head window is a yes with the prompt ID`() {
        prompts.onPromptSpoken("p-0001")
        prompts.onPromptDone("p-0001", 0)
        assertEquals(
            listOf(DeviceToServer.Intent(IntentKind.YES, IntentSource.HEAD, "p-0001")),
            feed(nod(), startMs = 500, Profiles.DEFAULT)
        )
    }

    @Test fun `a shake inside the head window is a no with the prompt ID`() {
        prompts.onPromptSpoken("p-0001")
        prompts.onPromptDone("p-0001", 0)
        assertEquals(
            listOf(DeviceToServer.Intent(IntentKind.NO, IntentSource.HEAD, "p-0001")),
            feed(shake(), startMs = 500, Profiles.DEFAULT)
        )
    }

    @Test fun `a nod that starts before the prompt ends sends nothing`() {
        prompts.onPromptSpoken("p-0001")
        val out = feed(nod(), startMs = 0, Profiles.DEFAULT, beforeSampleAt = 300) { prompts.onPromptDone("p-0001", 300) }
        assertEquals(emptyList<DeviceToServer.Intent>(), out)
    }

    @Test fun `a nod after the head window sends nothing`() {
        prompts.onPromptSpoken("p-0001")
        prompts.onPromptDone("p-0001", 0)
        assertEquals(emptyList<DeviceToServer.Intent>(), feed(nod(), startMs = 8100, Profiles.DEFAULT))
    }

    @Test fun `a nod long after the prompt is a yes when the profile has no head window`() {
        prompts.onPromptSpoken("p-0001")
        prompts.onPromptDone("p-0001", 0)
        assertEquals(1, feed(nod(), startMs = 60_000, Profiles.DEFAULT.copy(headWindowMs = null)).size)
    }

    @Test fun `a nod after a new prompt replaced the old one sends nothing`() {
        prompts.onPromptSpoken("p-0001")
        prompts.onPromptDone("p-0001", 0)
        prompts.onPromptSpoken("p-0002")
        assertEquals(emptyList<DeviceToServer.Intent>(), feed(nod(), startMs = 500, Profiles.DEFAULT))
    }

    // With the sound off, a new prompt is finished at once, so no sample arrives between the two head windows.
    @Test fun `a nod that starts in the head window of a replaced prompt sends nothing`() {
        prompts.onPromptSpoken("p-0001")
        prompts.onPromptDone("p-0001", 0)
        val out = feed(nod(), startMs = 500, Profiles.DEFAULT, beforeSampleAt = 260) {
            prompts.onPromptSpoken("p-0002")
            prompts.onPromptDone("p-0002", 760)
        }
        assertEquals(emptyList<DeviceToServer.Intent>(), out)
    }

    @Test fun `a nod is a no when the profile swaps the gestures`() {
        prompts.onPromptSpoken("p-0001")
        prompts.onPromptDone("p-0001", 0)
        val swapped = Profiles.DEFAULT.copy(yesGesture = YesGesture.SHAKE)
        assertEquals(IntentKind.NO, feed(nod(), 500, swapped).single().kind)
        assertEquals(IntentKind.YES, feed(shake(), 3000, swapped).single().kind)
    }

    @Test fun `sends nothing when head gestures are off`() {
        prompts.onPromptSpoken("p-0001")
        prompts.onPromptDone("p-0001", 0)
        assertEquals(emptyList<DeviceToServer.Intent>(), feed(nod(), 500, Profiles.DEFAULT.copy(headGestures = false)))
    }
}
