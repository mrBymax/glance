package com.metaglance.core.gesture

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

// The recordings of the test of 2026-11-14. Raise this value with each recording that the folder gets.
private const val MIN_RECORDINGS = 4

/**
 * Replays the motion files of `src/test/resources/motion` through the detector, with the accelerometer columns.
 *
 * A file name ends with `__nod<n>_shake<n>.csv`: the gestures that the person made, which the level `NORMAL` must
 * find. The name can also hold the counts of the other levels, for example
 * `shelf-3__nod1_shake0__gentle_nod1_shake0__firm_nod0_shake0.csv`. The test prints the counts of each level.
 *
 * `__nodmin<n>_shake<n>.csv` is for a file whose number of nods is not sure: the level must find n nods or more.
 */
class MotionReplayTest {
    // The axis map of ProbeDecisions: these recordings gave it. The pitch axis is the axis from ear to ear.
    private fun config(level: Sensitivity) = HeadGestureConfig.of(level, Axis.Y, 1, Axis.X)

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
        // Each file replays before the test fails, so one run shows each file that has other counts than its name.
        val wrong = ArrayList<String>()
        for (f in files.sortedBy { it.name }) {
            val normal = requireNotNull(Regex("__nod(min)?(\\d+)_shake(\\d+)").find(f.name)) { "${f.name} has no counts in its name" }
            val text = f.readText()
            for (level in Sensitivity.entries) {
                val out = replay(text, level)
                val nods = out.count { it == HeadGesture.NOD }
                val shakes = out.count { it == HeadGesture.SHAKE }
                println("${f.name} $level nods=$nods shakes=$shakes")
                val expected = if (level == Sensitivity.NORMAL) normal else Regex("__${level.name.lowercase()}_nod(min)?(\\d+)_shake(\\d+)").find(f.name)
                if (expected == null) continue
                val (atLeast, wantedNods, wantedShakes) = expected.destructured
                val nodsFit = if (atLeast.isEmpty()) nods == wantedNods.toInt() else nods >= wantedNods.toInt()
                if (!nodsFit || shakes != wantedShakes.toInt()) wrong.add("${f.name} $level nods=$nods shakes=$shakes")
            }
        }
        assertEquals(emptyList<String>(), wrong)
    }
}
