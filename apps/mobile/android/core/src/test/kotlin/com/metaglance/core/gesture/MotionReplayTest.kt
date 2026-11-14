package com.metaglance.core.gesture

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

// No recording exists before a session with the glasses records one. After the first such session, raise this value.
private const val MIN_RECORDINGS = 0

/**
 * Replays the motion files of `src/test/resources/motion` through the detector, with the accelerometer columns.
 *
 * A file name ends with `__nod<n>_shake<n>.csv`: the gestures that the person made, which the level `NORMAL` must
 * find. The name can also hold the counts of the other levels, for example
 * `shelf-3__nod1_shake0__gentle_nod1_shake0__firm_nod0_shake0.csv`. The test prints the counts of each level.
 */
class MotionReplayTest {
    // The axis map of ProbeDecisions. The detector uses it only for a sample with no accelerometer reading.
    private fun config(level: Sensitivity) = HeadGestureConfig.of(level, Axis.X, 1, Axis.Y)

    private fun replay(text: String, level: Sensitivity): List<HeadGesture> {
        val d = HeadGestureDetector(config(level))
        return MotionCsv.head(MotionCsv.parse(text)).mapNotNull { d.onSample(it) }
    }

    private fun nodRows() = GyroScript(config(Sensitivity.NORMAL)).rest(500).pitch(0.35, 250).pitch(-0.35, 250).rest(1000).rows()

    @Test fun `a synthetic nod survives the CSV format at each level`() {
        val text = nodRows().joinToString("\n") { MotionCsv.format(it) }
        for (level in Sensitivity.entries) assertEquals(level.name, listOf(HeadGesture.NOD), replay(text, level))
    }

    @Test fun `a recording with arrival times replays as one with no arrival times`() {
        val text = "# prompt p-0001\n" + nodRows().mapIndexed { i, row -> MotionCsv.formatTimed(row, 5000L + i * 33) }.joinToString("\n")
        assertEquals(listOf(HeadGesture.NOD), replay(text, Sensitivity.NORMAL))
    }

    @Test fun `each recording gives the counts in its file name`() {
        val files = File(javaClass.getResource("/motion")!!.toURI()).listFiles { f -> f.name.endsWith(".csv") }!!
        assertTrue("recordings: ${files.size}", files.size >= MIN_RECORDINGS)
        for (f in files) {
            val normal = requireNotNull(Regex("__nod(\\d+)_shake(\\d+)").find(f.name)) { "${f.name} has no counts in its name" }
            val text = f.readText()
            for (level in Sensitivity.entries) {
                val out = replay(text, level)
                val nods = out.count { it == HeadGesture.NOD }
                val shakes = out.count { it == HeadGesture.SHAKE }
                println("${f.name} $level nods=$nods shakes=$shakes")
                val expected = if (level == Sensitivity.NORMAL) normal else Regex("__${level.name.lowercase()}_nod(\\d+)_shake(\\d+)").find(f.name)
                if (expected == null) continue
                assertEquals("${f.name} $level nods", expected.groupValues[1].toInt(), nods)
                assertEquals("${f.name} $level shakes", expected.groupValues[2].toInt(), shakes)
            }
        }
    }
}
