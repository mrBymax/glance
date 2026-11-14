package com.metaglance.core.gesture

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class MotionCsvTest {
    private val row = MotionRow(500000000, 0f, 9.81f, 0f, 0.34f, -0.02f, 0f, 0f, 0f, 0f, 1f, 0f, 0f, 0f)
    private val line = "500000000,0.0,9.81,0.0,0.34,-0.02,0.0,0.0,0.0,0.0,1.0,0.0,0.0,0.0"

    @Test fun `formats one row as 14 values in the MockDeviceKit order`() {
        assertEquals(line, MotionCsv.format(row))
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

    // MockDeviceKit takes a row of 14 values only, and it skips a comment line. So the arrival time is a comment.
    @Test fun `writes the arrival time of a row as a comment line before the row`() {
        assertEquals("#a 123456\n$line", MotionCsv.formatTimed(row, 123456))
    }

    @Test fun `reads each row with its arrival time`() {
        val text = "# prompt p-0001\n#a 1000\n$line\n#a 1033\n$line\n"
        assertEquals(listOf(TimedRow(row, 1000), TimedRow(row, 1033)), MotionCsv.parseTimed(text))
    }

    @Test fun `a row with no arrival line has no arrival time`() {
        assertEquals(listOf(TimedRow(row, 1000), TimedRow(row, null)), MotionCsv.parseTimed("#a 1000\n$line\n$line"))
    }

    @Test fun `reads the rows of a file with arrival times as before`() {
        assertEquals(listOf(row, row), MotionCsv.parse("#a 1000\n$line\n#a 1033\n$line\n"))
    }

    @Test fun `gives the head samples, with no accelerometer reading for a row that holds 0 for it`() {
        val gyro = GyroSample(500000000, 0.34f, -0.02f, 0f)
        assertEquals(
            listOf(HeadSample(gyro, AccelSample(0f, 9.81f, 0f)), HeadSample(gyro, null)),
            MotionCsv.head(listOf(row, row.copy(accelY = 0f)))
        )
    }

    @Test fun `makes a row of a head sample`() {
        val gyro = GyroSample(500000000, 0.34f, -0.02f, 0f)
        assertEquals(row, MotionCsv.row(HeadSample(gyro, AccelSample(0f, 9.81f, 0f))))
        assertEquals(row.copy(accelY = 0f), MotionCsv.row(HeadSample(gyro, null)))
    }
}
