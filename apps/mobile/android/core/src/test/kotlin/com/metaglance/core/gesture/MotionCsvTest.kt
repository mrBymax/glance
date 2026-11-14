package com.metaglance.core.gesture

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class MotionCsvTest {
    private val row = MotionRow(500000000, 0f, 9.81f, 0f, 0.34f, -0.02f, 0f, 0f, 0f, 0f, 1f, 0f, 0f, 0f)

    @Test fun `formats one row as 14 values in the MockDeviceKit order`() {
        assertEquals("500000000,0.0,9.81,0.0,0.34,-0.02,0.0,0.0,0.0,0.0,1.0,0.0,0.0,0.0", MotionCsv.format(row))
    }

    @Test fun `parses what it formats`() {
        assertEquals(listOf(row), MotionCsv.parse(MotionCsv.format(row)))
    }

    @Test fun `skips blank lines and comment lines`() {
        assertEquals(2, MotionCsv.parse("# five nods\n\n${MotionCsv.format(row)}\n${MotionCsv.format(row)}\n").size)
    }

    @Test fun `rejects a row that does not have 14 values`() {
        assertThrows(IllegalArgumentException::class.java) { MotionCsv.parse("1,2,3") }
    }

    @Test fun `reads the gyroscope columns`() {
        assertEquals(listOf(GyroSample(500000000, 0.34f, -0.02f, 0f)), MotionCsv.gyro(listOf(row)))
    }
}
