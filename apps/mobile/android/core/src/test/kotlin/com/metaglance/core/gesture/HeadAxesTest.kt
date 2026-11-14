package com.metaglance.core.gesture

import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin
import org.junit.Assert.assertEquals
import org.junit.Test

// The axis map of ProbeDecisions is a default that nobody measured: pitch on x, yaw on y.
class HeadAxesTest {
    private val config = HeadGestureConfig.of(Sensitivity.NORMAL, Axis.X, 1, Axis.Y)

    /** The glasses as the Android sample of Meta measured them: y to the sky, x from ear to ear. */
    private val yUp = Mount(lateral = listOf(1.0, 0.0, 0.0), up = listOf(0.0, 1.0, 0.0))

    /** The glasses as the iOS sample of Meta measured them: x to the sky. */
    private val xUp = Mount(lateral = listOf(0.0, 0.0, 1.0), up = listOf(1.0, 0.0, 0.0))

    private fun script() = GyroScript(Mount.SCRIPT)

    private fun nod() = script().rest(500).pitch(0.26, 250).pitch(-0.26, 250).rest(1000)

    private fun shake() = script().rest(500).yaw(0.175, 200).yaw(-0.35, 200).yaw(0.35, 200).yaw(-0.175, 200).rest(1000)

    private fun gestures(samples: List<HeadSample>, level: Sensitivity = Sensitivity.NORMAL): List<HeadGesture> {
        val d = HeadGestureDetector(HeadGestureConfig.of(level, Axis.X, 1, Axis.Y))
        return samples.mapNotNull { d.onSample(it) }
    }

    private fun degrees(value: Double) = value * PI / 180

    @Test fun `gives the pitch rate and the yaw rate of glasses with y to the sky`() {
        val rates = HeadAxes(config).rates(HeadSample(GyroSample(0, 0.5f, -0.25f, 0.1f), AccelSample(0f, 9.81f, 0f)), 1.0 / 30)
        assertEquals(0.5, rates.pitch, 0.001)
        assertEquals(-0.25, rates.yaw, 0.001)
    }

    @Test fun `gives the rate about gravity as the yaw rate when x is to the sky`() {
        val rates = HeadAxes(config).rates(HeadSample(GyroSample(0, 0.8f, 0f, 0f), AccelSample(9.81f, 0f, 0f)), 1.0 / 30)
        assertEquals(0.0, rates.pitch, 0.001)
        assertEquals(0.8, rates.yaw, 0.001)
    }

    @Test fun `gives a turn about a level axis as the pitch rate when x is to the sky`() {
        val axes = HeadAxes(config)
        val down = axes.rates(HeadSample(GyroSample(0, 0f, 0f, -0.8f), AccelSample(9.81f, 0f, 0f)), 1.0 / 30)
        val back = axes.rates(HeadSample(GyroSample(33_333_333, 0f, 0f, 0.6f), AccelSample(9.81f, 0f, 0f)), 1.0 / 30)
        // The sign of the first movement is free. The movement back has the other sign.
        assertEquals(0.8, down.pitch, 0.001)
        assertEquals(-0.6, back.pitch, 0.02)
        assertEquals(0.0, down.yaw, 0.001)
    }

    @Test fun `uses the axis map when the sample has no accelerometer reading`() {
        val rates = HeadAxes(config).rates(HeadSample(GyroSample(0, 0.5f, -0.25f, 0.1f), null), 1.0 / 30)
        assertEquals(0.5, rates.pitch, 0.001)
        assertEquals(-0.25, rates.yaw, 0.001)
    }

    @Test fun `a nod is a NOD and a shake is a SHAKE with y to the sky`() {
        assertEquals(listOf(HeadGesture.NOD), gestures(yUp.samples(nod())))
        assertEquals(listOf(HeadGesture.SHAKE), gestures(yUp.samples(shake())))
    }

    @Test fun `a nod is a NOD and a shake is a SHAKE with x to the sky, for each ear axis`() {
        assertEquals(listOf(HeadGesture.NOD), gestures(xUp.samples(nod())))
        assertEquals(listOf(HeadGesture.SHAKE), gestures(xUp.samples(shake())))
        val earOnY = Mount(lateral = listOf(0.0, 1.0, 0.0), up = listOf(1.0, 0.0, 0.0))
        assertEquals(listOf(HeadGesture.NOD), gestures(earOnY.samples(nod())))
        assertEquals(listOf(HeadGesture.SHAKE), gestures(earOnY.samples(shake())))
    }

    // What the projection is for: with the axis map alone, glasses with x to the sky turn a no into a yes.
    @Test fun `with no accelerometer reading, a shake of glasses with x to the sky is taken for a nod`() {
        val d = HeadGestureDetector(config)
        assertEquals(listOf(HeadGesture.NOD), xUp.samples(shake()).mapNotNull { d.onSample(it.gyro) })
    }

    @Test fun `a head that looks 30 degrees down still gives the right gesture`() {
        val a = degrees(30.0)
        val down = Mount(lateral = listOf(1.0, 0.0, 0.0), up = listOf(0.0, cos(a), sin(a)))
        assertEquals(listOf(HeadGesture.NOD), gestures(down.samples(nod())))
        assertEquals(listOf(HeadGesture.SHAKE), gestures(down.samples(shake())))
    }

    @Test fun `a head that leans 35 degrees to the side still gives the right gesture`() {
        val a = degrees(35.0)
        val leaned = Mount(lateral = listOf(cos(a), -sin(a), 0.0), up = listOf(sin(a), cos(a), 0.0))
        assertEquals(listOf(HeadGesture.NOD), gestures(leaned.samples(nod())))
        assertEquals(listOf(HeadGesture.SHAKE), gestures(leaned.samples(shake())))
    }

    @Test fun `a nod of four cycles is one NOD when the ear axis is not known`() {
        val s = script().rest(500)
        repeat(4) { s.pitch(0.26, 250).pitch(-0.26, 250) }
        assertEquals(listOf(HeadGesture.NOD), gestures(xUp.samples(s.rest(1000))))
    }

    @Test fun `a walk gives no gesture in each mounting and at each level`() {
        for (mount in listOf(yUp, xUp)) {
            for (level in Sensitivity.entries) {
                val walk = mount.samples(script().rest(120_000)).map { sample ->
                    val t = sample.gyro.tNs / 1e9
                    val bob = (0.30 * sin(2 * PI * 2 * t)).toFloat()
                    val sway = (0.17 * sin(2 * PI * t + 1)).toFloat()
                    // A step moves the head up and down, so the accelerometer reads more and less than gravity.
                    val lift = (1 + 0.25 * sin(2 * PI * 2 * t)).toFloat()
                    val accel = sample.accel!!
                    val gyro = if (mount === yUp) sample.gyro.copy(x = bob, y = sway) else sample.gyro.copy(z = bob, x = sway)
                    HeadSample(gyro, AccelSample(accel.x * lift, accel.y * lift, accel.z * lift))
                }
                assertEquals("$level", emptyList<HeadGesture>(), gestures(walk, level))
            }
        }
    }
}
