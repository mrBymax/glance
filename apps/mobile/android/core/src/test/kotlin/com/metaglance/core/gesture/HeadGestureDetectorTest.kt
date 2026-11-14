package com.metaglance.core.gesture

import kotlin.math.PI
import kotlin.math.sin
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class HeadGestureDetectorTest {
    private val normal = HeadGestureConfig.of(Sensitivity.NORMAL, Axis.X, 1, Axis.Y)

    private fun script(config: HeadGestureConfig = normal) = GyroScript(config)

    private fun detect(s: GyroScript, config: HeadGestureConfig = normal): List<Pair<HeadGesture, Long>> {
        val d = HeadGestureDetector(config)
        return s.samples().mapNotNull { sample -> d.onSample(sample)?.let { it to sample.tNs / 1_000_000 } }
    }

    private fun gestures(s: GyroScript, config: HeadGestureConfig = normal) = detect(s, config).map { it.first }

    private fun reports(s: GyroScript): List<GestureReport> {
        val out = ArrayList<GestureReport>()
        val d = HeadGestureDetector(normal, out::add)
        s.samples().forEach { d.onSample(it) }
        return out
    }

    private fun outcomes(s: GyroScript) = reports(s).map { it.gesture to it.rejected }

    private fun nod(a: Double, ms: Int, config: HeadGestureConfig = normal) = script(config).rest(500).pitch(a, ms).pitch(-a, ms).rest(1000)

    private fun shake() = script().rest(500).yaw(0.175, 200).yaw(-0.35, 200).yaw(0.35, 200).yaw(-0.175, 200).rest(1000)

    /**
     * The head of a person who walks, with the values of the head studies: a pitch bob of 2 Hz with a top rate of
     * 17 degrees each second, and a sway to the sides of 1 Hz.
     */
    private fun walk(ms: Int, config: HeadGestureConfig): List<GyroSample> = GyroScript(config).rest(ms).samples().map {
        val t = it.tNs / 1e9
        it.copy(x = (0.30 * sin(2 * PI * 2 * t)).toFloat(), y = (0.17 * sin(2 * PI * t + 1)).toFloat())
    }

    @Test fun `a nod that starts down is one NOD, 300 ms after the head is back at the latest`() {
        val s = nod(0.26, 250)
        val out = detect(s)
        assertEquals(listOf(HeadGesture.NOD), out.map { it.first })
        assertTrue(out.single().second - s.lastMoveMs <= 300)
    }

    @Test fun `a nod that starts up is one NOD`() {
        assertEquals(listOf(HeadGesture.NOD), gestures(nod(-0.26, 250)))
    }

    @Test fun `a nod of 10 degrees at 40 degrees each second is a NOD at the normal level`() {
        assertEquals(listOf(HeadGesture.NOD), gestures(nod(0.175, 250)))
    }

    @Test fun `a nod that swings about the start position is one NOD`() {
        assertEquals(
            listOf(HeadGesture.NOD),
            gestures(script().rest(500).pitch(0.2, 220).pitch(-0.4, 300).pitch(0.2, 220).rest(1000))
        )
    }

    @Test fun `a nod whose return goes past the start is one NOD`() {
        assertEquals(
            listOf(HeadGesture.NOD),
            gestures(script().rest(500).pitch(0.26, 250).pitch(-0.39, 300).pitch(0.13, 200).rest(1000))
        )
    }

    @Test fun `a double nod is one NOD`() {
        assertEquals(
            listOf(HeadGesture.NOD),
            gestures(script().rest(500).pitch(0.26, 220).pitch(-0.26, 220).pitch(0.26, 220).pitch(-0.26, 220).rest(1000))
        )
    }

    @Test fun `a nod of 2 seconds with four cycles is one NOD`() {
        val s = script().rest(500)
        repeat(4) { s.pitch(0.26, 250).pitch(-0.26, 250) }
        assertEquals(listOf(HeadGesture.NOD), gestures(s.rest(1000)))
    }

    @Test fun `a slow start before the nod does not hide the nod`() {
        assertEquals(
            listOf(HeadGesture.NOD),
            gestures(script().rest(500).pitch(-0.12, 400).pitch(0.3, 250).pitch(-0.2, 250).rest(1000))
        )
    }

    @Test fun `two nods with a rest between them are two NODs`() {
        assertEquals(
            listOf(HeadGesture.NOD, HeadGesture.NOD),
            gestures(script().rest(500).pitch(0.26, 250).pitch(-0.26, 250).rest(1500).pitch(0.26, 250).pitch(-0.26, 250).rest(1000))
        )
    }

    @Test fun `a shake is one SHAKE`() {
        assertEquals(listOf(HeadGesture.SHAKE), gestures(shake()))
    }

    @Test fun `a slow shake with strokes of 700 ms is one SHAKE`() {
        assertEquals(
            listOf(HeadGesture.SHAKE),
            gestures(script().rest(500).yaw(0.225, 700).yaw(-0.45, 700).yaw(0.45, 700).yaw(-0.225, 700).rest(1000))
        )
    }

    @Test fun `a shake that also moves the pitch by 8 degrees is one SHAKE`() {
        assertEquals(
            listOf(HeadGesture.SHAKE),
            gestures(script().rest(500).both(0.07, 0.225, 300).both(-0.14, -0.45, 300).both(0.14, 0.45, 300).both(-0.07, -0.225, 300).rest(1000))
        )
    }

    @Test fun `a look down that stays is no gesture`() {
        assertEquals(emptyList<HeadGesture>(), gestures(script().rest(500).pitch(0.52, 600).rest(3000)))
    }

    @Test fun `a look down of 30 degrees with a slow return after 2 seconds is no gesture`() {
        assertEquals(
            emptyList<HeadGesture>(),
            gestures(script().rest(500).pitch(0.52, 800).rest(2000).pitch(-0.52, 1500).rest(1000))
        )
    }

    @Test fun `a look down with a small bounce is no gesture`() {
        assertEquals(emptyList<HeadGesture>(), gestures(script().rest(500).pitch(0.5, 300).pitch(-0.12, 150).rest(1500)))
    }

    @Test fun `a bend to a low shelf that does not return is not a nod`() {
        assertEquals(
            emptyList<HeadGesture>(),
            gestures(script().rest(500).pitch(0.7, 600).rest(2000).pitch(-0.7, 600).rest(1000))
        )
    }

    @Test fun `a put-back with a pause is not a nod`() {
        assertEquals(
            emptyList<HeadGesture>(),
            gestures(script().rest(500).pitch(0.5, 400).rest(1000).pitch(-0.5, 400).rest(1000))
        )
    }

    // One yaw pair is never a shake, at each speed: a shopper looks to the side and back many times in a shop.
    @Test fun `a look to the side and back is not a shake`() {
        assertEquals(emptyList<HeadGesture>(), gestures(script().rest(500).yaw(0.35, 250).yaw(-0.35, 250).rest(1000)))
    }

    @Test fun `a turn of 45 degrees to a shelf and back is not a shake`() {
        assertEquals(emptyList<HeadGesture>(), gestures(script().rest(500).yaw(0.79, 900).yaw(-0.79, 900).rest(1000)))
        assertEquals(emptyList<HeadGesture>(), gestures(script().rest(500).yaw(0.79, 400).yaw(-0.79, 400).rest(1000)))
    }

    @Test fun `a slow scan of a shelf is not a shake`() {
        assertEquals(
            emptyList<HeadGesture>(),
            gestures(script().rest(500).yaw(0.35, 900).yaw(-0.7, 1200).yaw(0.7, 1200).yaw(-0.35, 900).rest(1000))
        )
    }

    @Test fun `a diagonal movement is no gesture`() {
        assertEquals(
            emptyList<HeadGesture>(),
            gestures(script().rest(500).diagonal(0.26, 250).diagonal(-0.26, 250).rest(1000))
        )
    }

    @Test fun `the head of a person who walks gives no gesture at each level`() {
        for (level in Sensitivity.entries) {
            val config = HeadGestureConfig.of(level, Axis.X, 1, Axis.Y)
            val d = HeadGestureDetector(config)
            assertEquals(level.name, emptyList<HeadGesture>(), walk(300_000, config).mapNotNull { d.onSample(it) })
        }
    }

    @Test fun `walk noise for 15 minutes gives no gesture`() {
        assertEquals(emptyList<HeadGesture>(), gestures(script().rest(900_000).withWalk()))
        val gentle = HeadGestureConfig.of(Sensitivity.GENTLE, Axis.X, 1, Axis.Y)
        assertEquals(emptyList<HeadGesture>(), gestures(script().rest(60_000).withWalk(), gentle))
    }

    @Test fun `a nod and a shake still count during a walk`() {
        assertEquals(listOf(HeadGesture.NOD), gestures(nod(0.35, 250).withWalk()))
        assertEquals(listOf(HeadGesture.SHAKE), gestures(shake().withWalk()))
    }

    @Test fun `the three levels differ`() {
        fun at(level: Sensitivity, a: Double, ms: Int): Int {
            val config = HeadGestureConfig.of(level, Axis.X, 1, Axis.Y)
            return gestures(nod(a, ms, config), config).size
        }
        assertEquals(1, at(Sensitivity.GENTLE, 0.085, 200))
        assertEquals(0, at(Sensitivity.NORMAL, 0.085, 200))
        assertEquals(1, at(Sensitivity.NORMAL, 0.14, 220))
        assertEquals(0, at(Sensitivity.FIRM, 0.14, 220))
        assertEquals(1, at(Sensitivity.FIRM, 0.30, 250))
    }

    @Test fun `a gap in the sample times resets the detector`() {
        val d = HeadGestureDetector(normal)
        val out = nod(0.26, 250).samples().filterNot { it.tNs / 1_000_000 in 601..899 }.mapNotNull { d.onSample(it) }
        assertEquals(emptyList<HeadGesture>(), out)
    }

    @Test fun `the axis map applies when the sample has no accelerometer reading`() {
        val other = HeadGestureConfig.of(Sensitivity.NORMAL, Axis.Z, -1, Axis.X)
        assertEquals(listOf(HeadGesture.NOD), gestures(nod(0.26, 250, other), other))
        assertEquals(emptyList<HeadGesture>(), gestures(nod(0.26, 250), other))
    }

    @Test fun `an accepted nod gives one report with its numbers`() {
        val report = reports(nod(0.26, 250)).single()
        assertEquals(HeadGesture.NOD, report.gesture)
        assertNull(report.rejected)
        assertEquals(0.26, report.firstRad, 0.01)
        assertEquals(1.63, report.firstPeakRadS, 0.05)
        assertTrue(report.netRad <= 0.4 * report.firstRad)
        assertTrue(report.line(), report.line().startsWith("nod accepted: strokes 0.26 and "))
    }

    @Test fun `a stroke pair that is no nod gives one report with the reason`() {
        assertEquals(listOf(HeadGesture.NOD to Rejected.AMPLITUDE), outcomes(nod(0.7, 400)))
        // The first stroke is slow.
        assertEquals(listOf(HeadGesture.NOD to Rejected.PEAK), outcomes(script().rest(500).pitch(0.15, 320).pitch(-0.15, 150).rest(1000)))
        assertEquals(listOf(HeadGesture.NOD to Rejected.NET_ANGLE), outcomes(script().rest(500).pitch(0.5, 300).pitch(-0.12, 150).rest(1500)))
        assertEquals(
            listOf(HeadGesture.NOD to Rejected.DOMINANCE, HeadGesture.SHAKE to Rejected.TWO_STROKES),
            outcomes(script().rest(500).diagonal(0.26, 250).diagonal(-0.26, 250).rest(1000))
        )
    }

    @Test fun `a stroke pair that is no shake gives one report with the reason`() {
        val sideAndBack = script().rest(500).yaw(0.35, 250).yaw(-0.35, 250).rest(1000)
        assertEquals(listOf(HeadGesture.SHAKE to Rejected.TWO_STROKES), outcomes(sideAndBack))
        assertEquals(
            "shake rejected (two strokes only): strokes 0.35 and 0.35 rad, peaks 2.19 and 2.19 rad/s, 500 ms, net 0.00 rad, other axis 0.00 rad",
            reports(sideAndBack).single().line()
        )
        // Three strokes of 69 degrees: the turns are fast, and the first two strokes take longer than the limit.
        assertEquals(
            listOf(HeadGesture.SHAKE to Rejected.TIME, HeadGesture.SHAKE to Rejected.TWO_STROKES),
            outcomes(script().rest(500).yaw(1.2, 1200).yaw(-1.2, 1200).yaw(1.2, 1200).rest(1000))
        )
        assertEquals(
            listOf(HeadGesture.SHAKE to Rejected.DOMINANCE, HeadGesture.SHAKE to Rejected.TWO_STROKES),
            outcomes(script().rest(500).both(0.3, 0.35, 250).both(-0.3, -0.35, 250).both(0.3, 0.35, 250).rest(1000)).filter { it.first == HeadGesture.SHAKE }
        )
    }
}
