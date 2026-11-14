package com.metaglance.core.gesture

import org.junit.Assert.assertEquals
import org.junit.Test

class GyroStatsTest {
    @Test fun `names the axis with the most motion and the sign of its first excursion`() {
        val y = listOf(0f, 0.2f, -1.0f, -1.2f, 1.1f, 0.9f)
        val report = GyroStats.report(y.mapIndexed { i, v -> GyroSample(i * 33_000_000L, 0.1f, v, 0f) })
        assertEquals(Axis.Y, report.strongest)
        assertEquals(-1, report.firstSign)
        assertEquals(0.1f, report.rmsX, 0.001f)
    }

    @Test fun `gives sign 0 when no sample reaches the start rate`() {
        assertEquals(0, GyroStats.report(listOf(GyroSample(0, 0.1f, 0.2f, 0f))).firstSign)
    }
}
