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

/**
 * The motion file format of MockDeviceKit: no header row, 14 comma-separated values in the field order of [MotionRow].
 * [parse] skips blank lines and lines that start with `#`.
 */
object MotionCsv {
    private const val VALUES = 14

    // toString keeps the decimal point. A locale format writes a decimal comma on a Finnish or Italian phone.
    fun format(row: MotionRow): String = listOf(
        row.tNs,
        row.accelX, row.accelY, row.accelZ,
        row.gyroX, row.gyroY, row.gyroZ,
        row.magX, row.magY, row.magZ,
        row.orientationW, row.orientationX, row.orientationY, row.orientationZ
    ).joinToString(",") { it.toString() }

    fun parse(text: String): List<MotionRow> = text.lineSequence()
        .map { it.trim() }
        .filter { it.isNotEmpty() && !it.startsWith("#") }
        .map { parseRow(it) }
        .toList()

    fun gyro(rows: List<MotionRow>): List<GyroSample> = rows.map { GyroSample(it.tNs, it.gyroX, it.gyroY, it.gyroZ) }

    private fun parseRow(line: String): MotionRow {
        val parts = line.split(',').map { it.trim() }
        require(parts.size == VALUES) { "A motion row has $VALUES values. This row has ${parts.size}: $line" }
        val t = requireNotNull(parts[0].toLongOrNull()) { "The time of a motion row is a whole number: $line" }
        val f = parts.drop(1).map { requireNotNull(it.toFloatOrNull()) { "A motion value is not a number: $line" } }
        return MotionRow(t, f[0], f[1], f[2], f[3], f[4], f[5], f[6], f[7], f[8], f[9], f[10], f[11], f[12])
    }
}
