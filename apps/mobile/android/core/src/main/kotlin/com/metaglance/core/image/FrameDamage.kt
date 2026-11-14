package com.metaglance.core.image

import kotlin.math.abs

/**
 * Tells a frame that the HEVC decoder made from too little data: the picture is made of blocks, and the detail
 * inside the blocks is lost. The README has the numbers of the real frames behind each constant.
 *
 * The decoder works in blocks of 16, 32, or 64 pixels that start at the frame corner, so the edges of the blocks
 * are on the lines at each 16th pixel. The measure counts the luma steps on these lines and compares them with
 * the steps in the middle of the blocks. A scene has its edges at any place, so its ratio is near 1. Blur and a
 * flat wall have few steps at each place, so they are not damage.
 */
object FrameDamage {
    /** A frame with this score or more is damaged. */
    const val DAMAGED_AT = 1.45

    private const val LATTICE = 16

    /** The step at a line is the mean of this number of pixels after it, minus the mean of the same number before it. */
    private const val SIDE = 4

    /** The 4 rows of each 16 rows, and the 4 columns of each 16 columns, that the measure reads. */
    private val SAMPLES = intArrayOf(2, 6, 10, 14)

    /** A step counts when it is this number of luma levels above the larger step of its two neighbors, 4 pixels away. */
    private const val MIN_STEP = 6

    /** The middle of a block, as distances from the block line. */
    private val MIDDLE = 5..11

    /** With fewer steps than this share in the middle of the blocks, the ratio would be a ratio of noise. */
    private const val MIN_SHARE = 0.02

    /**
     * The weight of block lines that do not start at the frame corner. The real frames had their lines at the
     * corner. For another start the measure takes the best of 15 ratios, and the text lines of a screen reached
     * 1.8 that way.
     */
    private const val OTHER_START = 0.7

    fun isDamaged(luma: ByteArray, width: Int, height: Int): Boolean = of(luma, width, height) >= DAMAGED_AT

    /**
     * The damage score of the luma plane: near 1 for a scene, 0 for a frame with almost no steps, and
     * [DAMAGED_AT] or more for a frame of blocks. It is the smaller score of the two directions, because a
     * block has edges in both. The call reads only the first `width * height` bytes, so it takes an I420 frame
     * as it is. It reads one quarter of the pixels two times: 460 800 reads for a frame of 720 x 1280.
     */
    fun of(luma: ByteArray, width: Int, height: Int): Double {
        require(width > 0 && height > 0 && luma.size >= width * height) {
            "A $width x $height luma plane has ${width * height} bytes. This buffer has ${luma.size}."
        }
        if (width < 4 * SIDE + LATTICE || height < 4 * SIDE + LATTICE) return 0.0
        return minOf(columnLines(luma, width, height), rowLines(luma, width, height))
    }

    /** The score for the lines between columns. Each band of 16 rows gives one sum for each column. */
    private fun columnLines(luma: ByteArray, width: Int, height: Int): Double {
        val counts = Counts(width)
        val sums = IntArray(width)
        for (band in 0..height - LATTICE step LATTICE) {
            sums.fill(0)
            for (sample in SAMPLES) {
                val row = (band + sample) * width
                for (x in 0 until width) sums[x] += luma[row + x].toInt() and 0xFF
            }
            counts.add(sums, 0)
        }
        return counts.score()
    }

    /** The score for the lines between rows. Each band of 16 columns gives one sum for each row. */
    private fun rowLines(luma: ByteArray, width: Int, height: Int): Double {
        val counts = Counts(height)
        val bands = width / LATTICE
        // The sums of band 0 for each row, then the sums of band 1. One pass reads the rows in the order of the memory.
        val sums = IntArray(bands * height)
        for (y in 0 until height) {
            val row = y * width
            for (band in 0 until bands) {
                var sum = 0
                for (sample in SAMPLES) sum += luma[row + band * LATTICE + sample].toInt() and 0xFF
                sums[band * height + y] = sum
            }
        }
        for (band in 0 until bands) counts.add(sums, band * height)
        return counts.score()
    }

    /** Counts the steps of one direction for each place modulo 16. `across` is the number of pixels that a step crosses. */
    private class Counts(private val across: Int) {
        private val steps = IntArray(LATTICE)
        private val step = IntArray(across)
        private var bands = 0

        /** Adds one band. `sums[from + a]` is the sum of the samples of the band at the place `a`. */
        fun add(sums: IntArray, from: Int) {
            var difference = 0
            for (k in 0 until SIDE) difference += sums[from + SIDE + k] - sums[from + SIDE - 1 - k]
            step[SIDE] = abs(difference)
            for (a in SIDE + 1..across - SIDE) {
                // The window moves by one pixel: one pixel enters, one leaves, and one changes its side.
                difference += sums[from + a + SIDE - 1] - 2 * sums[from + a - 1] + sums[from + a - 1 - SIDE]
                step[a] = abs(difference)
            }
            for (a in 2 * SIDE..across - 2 * SIDE) {
                if (step[a] - maxOf(step[a - SIDE], step[a + SIDE]) >= MIN_STEP_SUM) steps[a and (LATTICE - 1)] += 1
            }
            bands += 1
        }

        fun score(): Double {
            val places = IntArray(LATTICE)
            for (a in 2 * SIDE..across - 2 * SIDE) places[a and (LATTICE - 1)] += bands
            val share = DoubleArray(LATTICE) { steps[it].toDouble() / places[it] }
            var otherStart = 0.0
            for (start in 1 until LATTICE) otherStart = maxOf(otherStart, ratio(share, start))
            return maxOf(ratio(share, 0), OTHER_START * otherStart)
        }
    }

    /** `MIN_STEP` for the sums of the samples of one band, on the `SIDE` pixels of each side. */
    private val MIN_STEP_SUM = MIN_STEP * SIDE * SAMPLES.size

    /** The share of steps on the block lines that start at `start`, over the median share in the middle of these blocks. */
    private fun ratio(share: DoubleArray, start: Int): Double {
        val middle = DoubleArray(MIDDLE.count()) { share[(start + MIDDLE.first + it) % LATTICE] }
        middle.sort()
        return share[start] / maxOf(middle[middle.size / 2], MIN_SHARE)
    }
}
