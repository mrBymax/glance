package com.metaglance.core.barcode

import org.junit.Assert.assertEquals
import org.junit.Test

class LabelTimingTest {
    private fun LabelPolicy.stills(range: IntProgression): List<Int> = range.filter { onFrame(it.toLong(), regionInView = true, codeAccepted = false) }

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

    @Test fun `the shared still limit is never longer than the gap of the label stills`() {
        assertEquals(5000, LabelTiming(2500, 6000).stillEveryMs)
        assertEquals(2000, LabelTiming(2500, 2000).stillEveryMs)
        assertEquals(5000, LabelTiming(2500, 60_000).stillEveryMs)
    }
}
