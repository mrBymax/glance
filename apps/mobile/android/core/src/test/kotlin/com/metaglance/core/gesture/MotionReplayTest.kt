package com.metaglance.core.gesture

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

// No recording exists before the probe run on the glasses. After that run, this value is 6.
private const val MIN_RECORDINGS = 0

/** Replays the motion files of `src/test/resources/motion`. A file name ends with `__nod<n>_shake<n>.csv`. */
class MotionReplayTest {
    // After the probe run on the glasses, the axes are those of ProbeDecisions.
    private val config = HeadGestureConfig.of(Sensitivity.NORMAL, Axis.X, 1, Axis.Y)

    @Test fun `a synthetic nod survives the CSV format`() {
        val text = GyroScript(config).rest(500).pitch(0.26, 250).pitch(-0.26, 250).rest(1000).rows()
            .joinToString("\n") { MotionCsv.format(it) }
        val d = HeadGestureDetector(config)
        assertEquals(listOf(HeadGesture.NOD), MotionCsv.gyro(MotionCsv.parse(text)).mapNotNull { d.onSample(it) })
    }

    @Test fun `each recording gives the counts in its file name`() {
        val files = File(javaClass.getResource("/motion")!!.toURI()).listFiles { f -> f.name.endsWith(".csv") }!!
        assertTrue("recordings: ${files.size}", files.size >= MIN_RECORDINGS)
        for (f in files) {
            val (nods, shakes) = Regex("__nod(\\d+)_shake(\\d+)\\.csv$").find(f.name)!!.destructured
            val d = HeadGestureDetector(config)
            val out = MotionCsv.gyro(MotionCsv.parse(f.readText())).mapNotNull { d.onSample(it) }
            assertEquals(f.name, nods.toInt(), out.count { it == HeadGesture.NOD })
            assertEquals(f.name, shakes.toInt(), out.count { it == HeadGesture.SHAKE })
        }
    }
}
