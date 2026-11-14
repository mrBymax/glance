package com.metaglance.core.gesture

data class MotionRow(
    val tNs: Long,
    val accelX: Float,
    val accelY: Float,
    val accelZ: Float,
    val gyroX: Float,
    val gyroY: Float,
    val gyroZ: Float,
    val magX: Float,
    val magY: Float,
    val magZ: Float,
    val orientationW: Float,
    val orientationX: Float,
    val orientationY: Float,
    val orientationZ: Float
)

/** A row with the phone time at which its sample arrived. `arrivalMs` is null for a file that holds no such times. */
data class TimedRow(val row: MotionRow, val arrivalMs: Long?)

/**
 * The motion file format of MockDeviceKit: no header row, 14 comma-separated values in the field order of [MotionRow].
 * [parse] skips blank lines and lines that start with `#`, as MockDeviceKit does.
 *
 * A recording of the app also holds the arrival time of each sample, as the line `#a <ms>` before its row.
 * MockDeviceKit takes a row of 14 values only, so the time is a comment and each reader of the format reads the file.
 */
object MotionCsv {
    private const val VALUES = 14
    private const val ARRIVAL = "#a "

    // toString keeps the decimal point. A locale format writes a decimal comma on a Finnish or Italian phone.
    fun format(row: MotionRow): String = listOf(
        row.tNs,
        row.accelX, row.accelY, row.accelZ,
        row.gyroX, row.gyroY, row.gyroZ,
        row.magX, row.magY, row.magZ,
        row.orientationW, row.orientationX, row.orientationY, row.orientationZ
    ).joinToString(",") { it.toString() }

    /** Two lines: the arrival time in ms on the phone clock, then the row. */
    fun formatTimed(row: MotionRow, arrivalMs: Long): String = "$ARRIVAL$arrivalMs\n${format(row)}"

    fun parse(text: String): List<MotionRow> = parseTimed(text).map { it.row }

    /** An arrival line counts for the one row that follows it. */
    fun parseTimed(text: String): List<TimedRow> {
        val rows = ArrayList<TimedRow>()
        var arrivalMs: Long? = null
        for (line in text.lineSequence().map { it.trim() }) {
            when {
                line.startsWith(ARRIVAL) -> arrivalMs = line.removePrefix(ARRIVAL).trim().toLongOrNull()
                line.isEmpty() || line.startsWith("#") -> Unit
                else -> {
                    rows.add(TimedRow(parseRow(line), arrivalMs))
                    arrivalMs = null
                }
            }
        }
        return rows
    }

    /** The samples for the head gestures. A row holds 0 for a sensor that sent nothing, so such a row has no accelerometer reading. */
    fun head(rows: List<MotionRow>): List<HeadSample> = rows.map { row ->
        val accel = AccelSample(row.accelX, row.accelY, row.accelZ).takeUnless { it.x == 0f && it.y == 0f && it.z == 0f }
        HeadSample(GyroSample(row.tNs, row.gyroX, row.gyroY, row.gyroZ), accel)
    }

    /** The row of a head sample: 0 for the magnetometer, and no rotation. */
    fun row(sample: HeadSample): MotionRow {
        val g = sample.gyro
        val a = sample.accel
        return MotionRow(g.tNs, a?.x ?: 0f, a?.y ?: 0f, a?.z ?: 0f, g.x, g.y, g.z, 0f, 0f, 0f, 1f, 0f, 0f, 0f)
    }

    private fun parseRow(line: String): MotionRow {
        val parts = line.split(',').map { it.trim() }
        require(parts.size == VALUES) { "A motion row has $VALUES values. This row has ${parts.size}: $line" }
        val t = requireNotNull(parts[0].toLongOrNull()) { "The time of a motion row is a whole number: $line" }
        val f = parts.drop(1).map { requireNotNull(it.toFloatOrNull()) { "A motion value is not a number: $line" } }
        return MotionRow(t, f[0], f[1], f[2], f[3], f[4], f[5], f[6], f[7], f[8], f[9], f[10], f[11], f[12])
    }
}
