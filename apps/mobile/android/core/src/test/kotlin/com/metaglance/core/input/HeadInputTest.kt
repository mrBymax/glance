package com.metaglance.core.input

import com.metaglance.core.contract.DeviceToServer
import com.metaglance.core.contract.IntentKind
import com.metaglance.core.contract.IntentSource
import com.metaglance.core.contract.KioskRef
import com.metaglance.core.contract.PendingKind
import com.metaglance.core.contract.ProductRef
import com.metaglance.core.contract.Profile
import com.metaglance.core.contract.Profiles
import com.metaglance.core.contract.ServerEvent
import com.metaglance.core.contract.YesGesture
import com.metaglance.core.gesture.Axis
import com.metaglance.core.gesture.GyroScript
import com.metaglance.core.gesture.HeadGesture
import com.metaglance.core.gesture.HeadGestureConfig
import com.metaglance.core.gesture.HeadGestureDetector
import com.metaglance.core.gesture.HeadSample
import com.metaglance.core.gesture.Sensitivity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// Review Focus 2: a nod that starts before the prompt ends, or that answers a replaced prompt, sends nothing.
class HeadInputTest {
    private val config = HeadGestureConfig.of(Sensitivity.NORMAL, Axis.X, 1, Axis.Y)
    private val prompts = PromptTracker()
    private val seen = ArrayList<String>()
    private val listener = object : HeadWindowListener {
        override fun onOpen(promptId: String, openMs: Long) {
            seen.add("open $promptId $openMs")
        }

        override fun onSample(sample: HeadSample, arrivalMs: Long) {
            seen.add("sample")
        }

        override fun onClose(promptId: String) {
            seen.add("close $promptId")
        }

        override fun onEarly(promptId: String, gesture: HeadGesture, earlyMs: Long) {
            seen.add("early $promptId ${gesture.name} $earlyMs")
        }
    }
    private val input = HeadInput(HeadGestureDetector(config), prompts, listener)
    private val yes = listOf(DeviceToServer.Intent(IntentKind.YES, IntentSource.HEAD, "p-0001"))
    private val nothing = emptyList<DeviceToServer.Intent>()

    private fun nod() = GyroScript(config).pitch(0.26, 250).pitch(-0.26, 250).rest(600)

    private fun shake() = GyroScript(config).yaw(0.175, 200).yaw(-0.35, 200).yaw(0.35, 200).yaw(-0.175, 200).rest(600)

    /** A rest of `ms`, then one nod, then a rest of `thenMs`. */
    private fun nodAt(ms: Int, thenMs: Int = 600) = GyroScript(config).rest(ms).pitch(0.26, 250).pitch(-0.26, 250).rest(thenMs)

    private fun finishedPrompt(doneMs: Long) {
        prompts.onPromptSpoken("p-0001")
        prompts.onPromptDone("p-0001", doneMs)
    }

    /** A product prompt whose line starts to play at `startMs`. */
    private fun productLine(startMs: Long) {
        prompts.onEvent(ServerEvent.GlancePending("p-0001", PendingKind.NEW, ProductRef("oat-drink-1l", "Oat drink", "1 l", 149), emptyList(), 0))
        prompts.onPromptSpoken("p-0001", startMs)
        prompts.onLineStart("p-0001", startMs)
    }

    private fun payLine(startMs: Long) {
        prompts.onEvent(ServerEvent.CheckoutOffered("p-0001", KioskRef("kiosk-1", "Checkout 3", "Demo Market"), 449, 3, false))
        prompts.onPromptSpoken("p-0001", startMs)
        prompts.onLineStart("p-0001", startMs)
    }

    /** A tracker of its own with a prompt whose line starts to play at `startMs`. */
    private fun promptAt(startMs: Long) = PromptTracker().also {
        it.onPromptSpoken("p-0001", startMs)
        it.onLineStart("p-0001", startMs)
    }

    /**
     * Gives each sample of a script to the head input. The glasses took a sample at `startMs` plus its time, and
     * `arrival` gives the time at which the phone gets it. A sample for which `arrival` returns null is lost.
     * With `beforeSampleAt`, it runs `block` before the first sample at or after that time.
     */
    private fun feed(
        script: GyroScript,
        startMs: Long,
        profile: Profile = Profiles.DEFAULT,
        beforeSampleAt: Long? = null,
        arrival: (Long) -> Long? = { it },
        block: () -> Unit = {}
    ): List<DeviceToServer.Intent> {
        var blockRan = false
        return script.samples().mapNotNull { sample ->
            val tMs = sample.tNs / 1_000_000
            if (beforeSampleAt != null && !blockRan && tMs >= beforeSampleAt) {
                blockRan = true
                block()
            }
            arrival(startMs + tMs)?.let { input.onSample(sample, it, profile) }
        }
    }

    @Test fun `a nod inside the head window is a yes with the prompt ID`() {
        finishedPrompt(0)
        assertEquals(yes, feed(nod(), startMs = 500))
    }

    @Test fun `a shake inside the head window is a no with the prompt ID`() {
        finishedPrompt(0)
        assertEquals(
            listOf(DeviceToServer.Intent(IntentKind.NO, IntentSource.HEAD, "p-0001")),
            feed(shake(), startMs = 500)
        )
    }

    @Test fun `a nod that starts before the prompt ends sends nothing`() {
        prompts.onPromptSpoken("p-0001")
        assertEquals(nothing, feed(nod(), startMs = 0, beforeSampleAt = 300) { prompts.onPromptDone("p-0001", 300) })
    }

    // The shopper of the test of 2026-11-14 nodded at the name of the product, seconds before the line ended.
    @Test fun `a nod while the line of a product prompt plays is a yes, from 300 ms after the start of the line`() {
        productLine(0)
        assertEquals(yes, feed(nodAt(400), startMs = 0))
    }

    @Test fun `a nod that starts in the first 300 ms of the line of a prompt sends nothing`() {
        productLine(0)
        assertEquals(nothing, feed(nodAt(100), startMs = 0))
    }

    @Test fun `a nod 400 ms into the line of a pay prompt is a yes`() {
        payLine(0)
        assertEquals(yes, feed(nodAt(400), startMs = 0))
    }

    @Test fun `a shake 400 ms into the line of a pay prompt is a no`() {
        payLine(0)
        val script = GyroScript(config).rest(400).yaw(0.175, 200).yaw(-0.35, 200).yaw(0.35, 200).yaw(-0.175, 200).rest(600)
        assertEquals(listOf(DeviceToServer.Intent(IntentKind.NO, IntentSource.HEAD, "p-0001")), feed(script, startMs = 0))
    }

    @Test fun `a nod 400 ms into the line of a prompt with no event that names its kind is a yes`() {
        prompts.onPromptSpoken("p-0001", 0)
        prompts.onLineStart("p-0001", 0)
        assertEquals(yes, feed(nodAt(400), startMs = 0))
    }

    @Test fun `a nod is a yes for a pay prompt whose line waits behind another line`() {
        prompts.onEvent(ServerEvent.CheckoutOffered("p-0001", KioskRef("kiosk-1", "Checkout 3", "Demo Market"), 449, 3, false))
        prompts.onPromptSpoken("p-0001", 0)
        assertEquals(yes, feed(nodAt(400), startMs = 0))
    }

    // The shopper looks down at the product and up again. With a detector that starts when the window opens, the
    // rest of the first stroke and the stroke back were a nod: measured for strokes of 500 to 700 ms.
    @Test fun `a slow movement down and back that started before the line sends nothing`() {
        for (line in listOf(::productLine, ::payLine)) {
            line(1000)
            val script = GyroScript(config).pitch(0.4, 600).pitch(-0.4, 600).rest(600)
            assertEquals(nothing, feed(script, startMs = 950))
        }
    }

    @Test fun `no nod and no shake that started before the line is an answer`() {
        val strokes = listOf(150, 250, 400, 500, 600, 700).flatMap { ms -> listOf(0.15, 0.26, 0.4, 0.55).map { rad -> ms to rad } }
        for ((strokeMs, rad) in strokes) {
            for (startMs in 0L..1500L step 33) {
                val nod = GyroScript(config).pitch(rad, strokeMs).pitch(-rad, strokeMs).rest(800)
                val shake = GyroScript(config).yaw(rad / 2, strokeMs).yaw(-rad, strokeMs).yaw(rad, strokeMs).yaw(-rad / 2, strokeMs).rest(800)
                for (script in listOf(nod, shake)) {
                    val fresh = HeadInput(HeadGestureDetector(config), promptAt(1500))
                    val out = script.samples().mapNotNull { fresh.onSample(it, startMs + it.tNs / 1_000_000, Profiles.DEFAULT) }
                    assertEquals("strokes of $strokeMs ms and $rad rad from $startMs", nothing, out)
                }
            }
        }
    }

    // The shopper looks along the shelf: left, right, left. The second and the third stroke start in the window.
    @Test fun `a shake that started before the line sends nothing, also when its later strokes start in the window`() {
        productLine(1000)
        val script = GyroScript(config).yaw(0.2, 600).yaw(-0.4, 600).yaw(0.4, 600).yaw(-0.2, 600).rest(800)
        assertEquals(nothing, feed(script, startMs = 800))
    }

    @Test fun `after a movement that started before the line and a rest, a nod is a yes`() {
        productLine(1000)
        val script = GyroScript(config).pitch(0.4, 600).pitch(-0.4, 600).rest(500).pitch(0.26, 250).pitch(-0.26, 250).rest(600)
        assertEquals(yes, feed(script, startMs = 950))
    }

    @Test fun `a turn to the kiosk and back that started before the line of a pay prompt sends nothing`() {
        payLine(1000)
        val script = GyroScript(config).yaw(0.5, 500).yaw(-0.5, 500).yaw(0.2, 300).rest(600)
        assertEquals(nothing, feed(script, startMs = 900))
    }

    @Test fun `a nod that the end of the line of a product prompt cuts is a yes`() {
        productLine(0)
        assertEquals(yes, feed(nodAt(2000), startMs = 0, beforeSampleAt = 2300) { prompts.onPromptDone("p-0001", 2300) })
    }

    @Test fun `the length of the head window of a product prompt counts from the end of its line`() {
        productLine(0)
        prompts.onPromptDone("p-0001", 6000)
        assertEquals(yes, feed(nodAt(13_000), startMs = 0))
    }

    @Test fun `a nod after the head window of a product prompt sends nothing`() {
        productLine(0)
        prompts.onPromptDone("p-0001", 6000)
        assertEquals(nothing, feed(nodAt(14_100), startMs = 0))
    }

    // An interrupt removes a line with no report of its end.
    @Test fun `the head window of a product prompt whose line never ends closes 28 seconds after the start of the line`() {
        productLine(0)
        assertEquals(nothing, feed(nodAt(28_100), startMs = 0))
    }

    @Test fun `a stall that ends while the line plays adds nothing to the head window`() {
        productLine(0)
        input.setBlocked(true, 2000, Profiles.DEFAULT)
        input.setBlocked(false, 5000, Profiles.DEFAULT)
        prompts.onPromptDone("p-0001", 6000)
        assertEquals(nothing, feed(nodAt(14_100), startMs = 0))
    }

    @Test fun `a stall that runs when the line ends adds its time after that end to the head window`() {
        productLine(0)
        input.setBlocked(true, 5000, Profiles.DEFAULT)
        prompts.onPromptDone("p-0001", 6000)
        input.setBlocked(false, 9000, Profiles.DEFAULT)
        assertEquals(yes, feed(nodAt(16_000), startMs = 0, arrival = { if (it in 5000..9000) null else it }))
    }

    @Test fun `the listener gets the head window of a product prompt with the time from which samples count`() {
        productLine(0)
        input.onTick(100, Profiles.DEFAULT)
        assertEquals(listOf("open p-0001 300"), seen)
    }

    @Test fun `a nod after the head window sends nothing`() {
        finishedPrompt(0)
        assertEquals(nothing, feed(nod(), startMs = 8100))
    }

    @Test fun `a nod long after the prompt is a yes when the profile has no head window`() {
        finishedPrompt(0)
        assertEquals(1, feed(nod(), startMs = 60_000, Profiles.DEFAULT.copy(headWindowMs = null)).size)
    }

    @Test fun `a nod after a new prompt replaced the old one sends nothing`() {
        finishedPrompt(0)
        prompts.onPromptSpoken("p-0002")
        assertEquals(nothing, feed(nod(), startMs = 500))
    }

    // With the sound off, a new prompt is finished at once, so no sample arrives between the two head windows.
    @Test fun `a nod that starts in the head window of a replaced prompt sends nothing`() {
        finishedPrompt(0)
        val out = feed(nod(), startMs = 500, beforeSampleAt = 260) {
            prompts.onPromptSpoken("p-0002")
            prompts.onPromptDone("p-0002", 760)
        }
        assertEquals(nothing, out)
    }

    @Test fun `a nod is a no when the profile swaps the gestures`() {
        finishedPrompt(0)
        val swapped = Profiles.DEFAULT.copy(yesGesture = YesGesture.SHAKE)
        assertEquals(IntentKind.NO, feed(nod(), 500, swapped).single().kind)
        assertEquals(IntentKind.YES, feed(shake(), 3000, swapped).single().kind)
    }

    @Test fun `sends nothing when head gestures are off`() {
        finishedPrompt(0)
        assertEquals(nothing, feed(nod(), 500, Profiles.DEFAULT.copy(headGestures = false)))
    }

    // The link to the glasses stalled for 3 to 12 seconds in the test of 2026-11-14, and then gave the samples at once.
    @Test fun `a nod in a stall is a yes when its samples arrive together after the head window`() {
        finishedPrompt(1500)
        val out = feed(nodAt(3000, thenMs = 9000), startMs = 0, arrival = { if (it < 1000) it else maxOf(it, 12_000) })
        assertEquals(yes, out)
    }

    @Test fun `a sample that arrives more than 6 seconds after the head window does not count`() {
        finishedPrompt(1500)
        val out = feed(nodAt(3000, thenMs = 13_000), startMs = 0, arrival = { if (it < 1000) it else maxOf(it, 15_600) })
        assertEquals(nothing, out)
    }

    @Test fun `a nod before the end of the prompt sends nothing, also when its samples arrive after that end`() {
        finishedPrompt(2000)
        assertEquals(nothing, feed(nodAt(1000), startMs = 0, arrival = { if (it < 900) it else maxOf(it, 2500) }))
    }

    @Test fun `the head window does not run while the samples are stalled`() {
        finishedPrompt(1000)
        input.setBlocked(true, 2000, Profiles.DEFAULT)
        input.setBlocked(false, 11_000, Profiles.DEFAULT)
        // The samples of the stall are lost. The nod comes 11 seconds after the prompt.
        assertEquals(yes, feed(nodAt(12_000), startMs = 0, arrival = { if (it in 2000..11_000) null else it }))
    }

    @Test fun `with no stall, the same nod is after the head window`() {
        finishedPrompt(1000)
        assertEquals(nothing, feed(nodAt(12_000), startMs = 0, arrival = { if (it in 2000..11_000) null else it }))
    }

    @Test fun `a stall adds 15 seconds to the head window at most`() {
        finishedPrompt(1000)
        input.setBlocked(true, 2000, Profiles.DEFAULT)
        input.setBlocked(false, 30_000, Profiles.DEFAULT)
        assertEquals(nothing, feed(nodAt(31_000), startMs = 0, arrival = { if (it in 2000..30_000) null else it }))
    }

    @Test fun `the head window starts at the end of a still that runs when the prompt ends`() {
        input.setBlocked(true, 0, Profiles.DEFAULT)
        finishedPrompt(1000)
        input.setBlocked(false, 4000, Profiles.DEFAULT)
        assertEquals(yes, feed(nodAt(11_000), startMs = 0))
    }

    // Phone times of the log, from 22:34:30.000. A still ran from 2106 to 6932, and no motion sample arrived from
    // 2966 to 9618. The line of p-0003 started at 4928. The server replaced p-0003 at 9585, 33 ms before the samples
    // of the stall arrived, so its head window closed with no sample. This test keeps the prompt, as the server does now.
    @Test fun `the session of 2026-11-14, a nod in the stall of a still counts for the prompt that arrived in that stall`() {
        input.setBlocked(true, 2966, Profiles.DEFAULT)
        productLine(4928)
        prompts.onPromptDone("p-0001", 7928)
        val out = feed(nodAt(7000, thenMs = 3000), startMs = 0, arrival = { if (it < 2966) it else maxOf(it, 9618) })
        assertEquals(yes, out)
    }

    @Test fun `the head window of a prompt that arrived in a stall has its full length after the stall`() {
        input.setBlocked(true, 2966, Profiles.DEFAULT)
        productLine(4928)
        prompts.onPromptDone("p-0001", 7928)
        input.setBlocked(false, 9618, Profiles.DEFAULT)
        // The line ended 1690 ms before the end of the stall, so the window ends at 7928 + 8000 + 1690.
        assertTrue(input.holdsStills(17_617, Profiles.DEFAULT))
        assertFalse(input.holdsStills(17_618, Profiles.DEFAULT))
        assertEquals(yes, feed(nodAt(16_500), startMs = 0, arrival = { if (it in 2966..9618) null else it }))
    }

    @Test fun `a stall after the end of the head window does not open it again`() {
        finishedPrompt(1000)
        input.setBlocked(true, 10_000, Profiles.DEFAULT)
        // The nod comes 200 ms after the end of the window, and its samples arrive in the stall.
        assertEquals(nothing, feed(nodAt(9200, thenMs = 4500), startMs = 0, arrival = { if (it < 9100) it else maxOf(it, 13_000) }))
    }

    @Test fun `no still starts from the start of a prompt line to its answer`() {
        assertFalse(input.holdsStills(0, Profiles.DEFAULT))
        prompts.onPromptSpoken("p-0001", 100)
        assertTrue(input.holdsStills(200, Profiles.DEFAULT))
        prompts.onPromptDone("p-0001", 3000)
        assertTrue(input.holdsStills(3100, Profiles.DEFAULT))
        assertEquals(yes, feed(nodAt(1000), startMs = 3000))
        assertFalse(input.holdsStills(5000, Profiles.DEFAULT))
    }

    @Test fun `stills start again at the end of the head window`() {
        finishedPrompt(3000)
        assertTrue(input.holdsStills(10_999, Profiles.DEFAULT))
        assertFalse(input.holdsStills(11_000, Profiles.DEFAULT))
    }

    @Test fun `stills start again when the server ends the prompt, and they do not wait with head gestures off`() {
        finishedPrompt(3000)
        assertFalse(input.holdsStills(4000, Profiles.DEFAULT.copy(headGestures = false)))
        assertTrue(input.holdsStills(4000, Profiles.DEFAULT))
        prompts.onEvent(ServerEvent.GlanceCleared("p-0001"))
        assertFalse(input.holdsStills(4100, Profiles.DEFAULT))
    }

    @Test fun `a stalled head window holds the stills until its later end`() {
        finishedPrompt(3000)
        input.setBlocked(true, 4000, Profiles.DEFAULT)
        assertTrue(input.holdsStills(12_000, Profiles.DEFAULT))
        input.setBlocked(false, 6000, Profiles.DEFAULT)
        assertTrue(input.holdsStills(12_999, Profiles.DEFAULT))
        assertFalse(input.holdsStills(13_000, Profiles.DEFAULT))
    }

    // The head window of such a prompt takes an answer for 20 seconds and the length of the window.
    @Test fun `a prompt line that does not end holds the stills for 28 seconds`() {
        prompts.onPromptSpoken("p-0001", 1000)
        assertTrue(input.holdsStills(28_999, Profiles.DEFAULT))
        assertFalse(input.holdsStills(29_000, Profiles.DEFAULT))
    }

    @Test fun `with no head window, a prompt holds the stills for 30 seconds`() {
        val noWindow = Profiles.DEFAULT.copy(headWindowMs = null)
        finishedPrompt(3000)
        assertTrue(input.holdsStills(32_999, noWindow))
        assertFalse(input.holdsStills(33_000, noWindow))
    }

    @Test fun `the listener gets the start of a head window, its samples, and its end`() {
        finishedPrompt(1000)
        // The script has 60 samples. The detector gets the samples from 300 ms before the window: the sample at 700 ms is the first one.
        feed(GyroScript(config).rest(2000), startMs = 0)
        assertEquals(listOf("open p-0001 1000") + List(39) { "sample" }, seen)
        seen.clear()
        input.onTick(14_999, Profiles.DEFAULT)
        assertEquals(emptyList<String>(), seen)
        // The window ends at 9000 ms, and a late sample counts for 6 seconds more.
        input.onTick(15_000, Profiles.DEFAULT)
        input.onTick(15_100, Profiles.DEFAULT)
        assertEquals(listOf("close p-0001"), seen)
    }

    @Test fun `after its close, the head input takes no sample and opens no window`() {
        finishedPrompt(0)
        input.onTick(100, Profiles.DEFAULT)
        input.close()
        assertEquals(nothing, feed(nod(), startMs = 500))
        assertFalse(input.holdsStills(600, Profiles.DEFAULT))
        assertEquals(listOf("open p-0001 0", "close p-0001"), seen)
    }

    @Test fun `the listener gets a gesture that started before the head window`() {
        productLine(0)
        assertEquals(nothing, feed(nodAt(100), startMs = 0))
        assertEquals(1, seen.count { it.startsWith("early p-0001 NOD") })
    }

    @Test fun `a new prompt ends the head window of the old one for the listener`() {
        finishedPrompt(1000)
        input.onTick(1100, Profiles.DEFAULT)
        prompts.onPromptSpoken("p-0002")
        input.onTick(1200, Profiles.DEFAULT)
        prompts.onPromptDone("p-0002", 2000)
        input.onTick(2100, Profiles.DEFAULT)
        input.close()
        assertEquals(listOf("open p-0001 1000", "close p-0001", "open p-0002 2000", "close p-0002"), seen)
    }
}
