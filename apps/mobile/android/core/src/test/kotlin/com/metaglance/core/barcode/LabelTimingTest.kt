package com.metaglance.core.barcode

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LabelTimingTest {
    private fun LabelPolicy.stills(range: Iterable<Int>): List<Int> = range.filter { onFrame(it.toLong(), regionInView = true, codeAccepted = false) }

    @Test fun `the default wait is 1000 ms, and the default gap is 6000 ms`() {
        assertEquals(1000L, LabelTiming.DEFAULT_WAIT_MS)
        assertEquals(6000L, LabelTiming.DEFAULT_GAP_MS)
    }

    @Test fun `the build of the app has the defaults of the label timing`() {
        val build = File("../app/build.gradle.kts").readText()
        assertTrue(build.contains("localMs(\"glance.labelWaitMs\", ${LabelTiming.DEFAULT_WAIT_MS})"))
        assertTrue(build.contains("localMs(\"glance.labelGapMs\", ${LabelTiming.DEFAULT_GAP_MS})"))
    }

    @Test fun `an empty field gives the default again`() {
        assertEquals(MsField.Empty, LabelTiming.readField("", LabelTiming.WAIT_LIMITS_MS))
        assertEquals(MsField.Empty, LabelTiming.readField("  ", LabelTiming.GAP_LIMITS_MS))
    }

    @Test fun `reads a whole number, with spaces around it`() {
        assertEquals(MsField.Value(1500), LabelTiming.readField(" 1500 ", LabelTiming.WAIT_LIMITS_MS))
        assertEquals(MsField.Value(8000), LabelTiming.readField("8000", LabelTiming.GAP_LIMITS_MS))
    }

    @Test fun `brings a number into the limits of its field`() {
        assertEquals(MsField.Value(300), LabelTiming.readField("299", LabelTiming.WAIT_LIMITS_MS))
        assertEquals(MsField.Value(300), LabelTiming.readField("-5", LabelTiming.WAIT_LIMITS_MS))
        assertEquals(MsField.Value(10_000), LabelTiming.readField("10001", LabelTiming.WAIT_LIMITS_MS))
        assertEquals(MsField.Value(2000), LabelTiming.readField("0", LabelTiming.GAP_LIMITS_MS))
        assertEquals(MsField.Value(60_000), LabelTiming.readField("99999999999999999999", LabelTiming.GAP_LIMITS_MS))
    }

    @Test fun `a text that is no whole number is not a value`() {
        for (text in listOf("2.5", "2,5", "2500 ms", "fast", "1e3", "--5")) {
            assertEquals(text, MsField.NotANumber, LabelTiming.readField(text, LabelTiming.WAIT_LIMITS_MS))
        }
    }

    @Test fun `brings the values of the build and of the store into the limits`() {
        assertEquals(LabelTiming(2500, 6000), LabelTiming.within(2500, 6000))
        assertEquals(LabelTiming(300, 2000), LabelTiming.within(0, 0))
        assertEquals(LabelTiming(10_000, 60_000), LabelTiming.within(Long.MAX_VALUE, Long.MAX_VALUE))
    }

    @Test fun `the label policy waits and limits with the two values`() {
        assertEquals(listOf(800, 3800, 6800), LabelTiming(waitMs = 800, gapMs = 3000).labelPolicy().stills(0..9000 step 100))
        assertEquals(listOf(2500, 8500), LabelTiming(waitMs = 2500, gapMs = 6000).labelPolicy().stills(0..12000 step 100))
    }

    // At 2 frames each second, one missed frame is a gap of 1000 ms.
    @Test fun `the label policy of a slow stream keeps the wait of a region over a longer gap`() {
        val frames = listOf(0, 500, 1500, 2000, 2500)
        assertEquals(listOf(2500), LabelTiming(waitMs = 1000, gapMs = 6000).labelPolicy().stills(frames))
        assertEquals(listOf(1500), LabelTiming(waitMs = 1000, gapMs = 6000).labelPolicy(regionGapMs = 1250).stills(frames))
    }

    @Test fun `the shared still limit is never longer than the gap of the label stills`() {
        assertEquals(5000, LabelTiming(2500, 6000).stillEveryMs)
        assertEquals(2000, LabelTiming(2500, 2000).stillEveryMs)
        assertEquals(5000, LabelTiming(2500, 60_000).stillEveryMs)
    }
}
