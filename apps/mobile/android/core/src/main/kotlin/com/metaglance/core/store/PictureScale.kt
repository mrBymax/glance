package com.metaglance.core.store

/** The size of a reference picture that the phone sends. A photo of a phone camera has 12 megapixels and more. */
object PictureScale {
    /** The long side of a sent picture, in pixels. A recognition call reads a reference picture at a low resolution. */
    const val MAX_LONG_SIDE = 1600
    const val JPEG_QUALITY = 88

    /**
     * The largest power of two that keeps the long side at `maxLongSide` or above, for the decoder: it then reads a
     * photo in a part of its memory. 1 for a photo that is not twice as large.
     */
    fun sampleSize(width: Int, height: Int, maxLongSide: Int = MAX_LONG_SIDE): Int {
        var sample = 1
        while (maxOf(width, height) / (sample * 2) >= maxLongSide) sample *= 2
        return sample
    }

    /** The size with the long side at `maxLongSide` and the same shape. A smaller picture keeps its size. */
    fun fit(width: Int, height: Int, maxLongSide: Int = MAX_LONG_SIDE): Pair<Int, Int> {
        val long = maxOf(width, height)
        if (long <= maxLongSide) return width to height
        // Whole numbers with a round to the nearest pixel: (side * max + long / 2) / long.
        fun scaled(side: Int): Int = ((side.toLong() * maxLongSide + long / 2) / long).toInt().coerceAtLeast(1)
        return scaled(width) to scaled(height)
    }
}
