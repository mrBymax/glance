package com.metaglance.core.gesture

import org.junit.Assert.assertEquals
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

    private fun nod(a: Double, ms: Int, config: HeadGestureConfig = normal) = script(config).rest(500).pitch(a, ms).pitch(-a, ms).rest(1000)

    private fun shake() = script().rest(500).yaw(0.175, 200).yaw(-0.35, 200).yaw(0.35, 200).yaw(-0.175, 200).rest(1000)

    @Test fun `a nod is one NOD within 400 ms after it ends`() {
        val s = nod(0.26, 250)
        val out = detect(s)
        assertEquals(listOf(HeadGesture.NOD), out.map { it.first })
        assertTrue(out.single().second - s.lastMoveMs <= 400)
    }

    @Test fun `a shake is one SHAKE`() {
        assertEquals(listOf(HeadGesture.SHAKE), gestures(shake()))
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

    @Test fun `a look up and back is not a nod`() {
        assertEquals(emptyList<HeadGesture>(), gestures(nod(-0.26, 250)))
    }

    @Test fun `a look to the side and back is not a shake`() {
        assertEquals(emptyList<HeadGesture>(), gestures(script().rest(500).yaw(0.35, 250).yaw(-0.35, 250).rest(1000)))
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

    @Test fun `walk noise for 15 minutes gives no gesture`() {
        assertEquals(emptyList<HeadGesture>(), gestures(script().rest(900_000).withWalk()))
        val gentle = HeadGestureConfig.of(Sensitivity.GENTLE, Axis.X, 1, Axis.Y)
        assertEquals(emptyList<HeadGesture>(), gestures(script().rest(60_000).withWalk(), gentle))
    }

    @Test fun `a nod and a shake still count during a walk`() {
        assertEquals(listOf(HeadGesture.NOD), gestures(nod(0.35, 250).withWalk()))
        assertEquals(listOf(HeadGesture.SHAKE), gestures(shake().withWalk()))
    }

    @Test fun `a double nod is one NOD`() {
        assertEquals(
            listOf(HeadGesture.NOD),
            gestures(script().rest(500).pitch(0.26, 220).pitch(-0.26, 220).pitch(0.26, 220).pitch(-0.26, 220).rest(1000))
        )
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

    @Test fun `a gap in the samples resets the detector`() {
        val d = HeadGestureDetector(normal)
        val out = nod(0.26, 250).samples().filterNot { it.tNs / 1_000_000 in 601..899 }.mapNotNull { d.onSample(it) }
        assertEquals(emptyList<HeadGesture>(), out)
    }

    @Test fun `the axis map and the sign apply`() {
        val other = HeadGestureConfig.of(Sensitivity.NORMAL, Axis.Z, -1, Axis.X)
        assertEquals(listOf(HeadGesture.NOD), gestures(nod(0.26, 250, other), other))
        assertEquals(emptyList<HeadGesture>(), gestures(nod(0.26, 250), other))
    }
}
