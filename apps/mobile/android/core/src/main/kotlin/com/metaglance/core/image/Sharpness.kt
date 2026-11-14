package com.metaglance.core.image

object Sharpness {
    private const val STEP = 4

    /**
     * The mean of the squared 4-neighbor Laplacian of the luma plane, over each 4th pixel in both directions.
     * A larger value means a sharper image. The call reads only the first `width * height` bytes,
     * so it takes an I420 frame as it is. A neighbor outside the image has the value of the nearest pixel inside.
     */
    fun of(luma: ByteArray, width: Int, height: Int): Double {
        require(width > 0 && height > 0 && luma.size >= width * height) {
            "A $width x $height luma plane has ${width * height} bytes. This buffer has ${luma.size}."
        }
        fun at(x: Int, y: Int) = luma[y.coerceIn(0, height - 1) * width + x.coerceIn(0, width - 1)].toInt() and 0xFF

        var sum = 0.0
        var count = 0
        for (y in 0 until height step STEP) {
            for (x in 0 until width step STEP) {
                val laplacian = at(x - 1, y) + at(x + 1, y) + at(x, y - 1) + at(x, y + 1) - 4 * at(x, y)
                sum += laplacian.toDouble() * laplacian
                count += 1
            }
        }
        return sum / count
    }
}
