package com.metaglance.core.image

object I420 {
    /** The number of bytes of one I420 frame. Width and height must be even. */
    fun frameBytes(width: Int, height: Int): Int = width * height * 3 / 2

    /**
     * Converts an I420 frame to NV21: the Y plane, then V and U bytes in pairs. Android image classes read NV21.
     * The call ignores bytes after the frame.
     */
    fun toNv21(i420: ByteArray, width: Int, height: Int): ByteArray {
        require(width > 0 && height > 0 && width % 2 == 0 && height % 2 == 0) {
            "An I420 frame has an even width and an even height. This frame is $width x $height."
        }
        val ySize = width * height
        val chromaSize = ySize / 4
        require(i420.size >= ySize + 2 * chromaSize) {
            "A $width x $height frame has ${ySize + 2 * chromaSize} bytes. This buffer has ${i420.size}."
        }
        val nv21 = ByteArray(ySize + 2 * chromaSize)
        System.arraycopy(i420, 0, nv21, 0, ySize)
        for (i in 0 until chromaSize) {
            nv21[ySize + 2 * i] = i420[ySize + chromaSize + i]
            nv21[ySize + 2 * i + 1] = i420[ySize + i]
        }
        return nv21
    }

    /**
     * Converts the `crop` of an I420 frame to `outWidth * outHeight` ARGB pixels in rows, with alpha 0xFF.
     * Each output pixel takes the nearest sample. The color math is BT.709 limited range in 8-bit fixed point.
     */
    fun cropScaleToArgb(i420: ByteArray, width: Int, height: Int, crop: RectPx, outWidth: Int, outHeight: Int): IntArray {
        require(width > 0 && height > 0 && width % 2 == 0 && height % 2 == 0) {
            "An I420 frame has an even width and an even height. This frame is $width x $height."
        }
        require(i420.size >= frameBytes(width, height)) {
            "A $width x $height frame has ${frameBytes(width, height)} bytes. This buffer has ${i420.size}."
        }
        require(
            crop.left >= 0 &&
                crop.top >= 0 &&
                crop.width > 0 &&
                crop.height > 0 &&
                crop.left + crop.width <= width &&
                crop.top + crop.height <= height
        ) { "The crop $crop is not inside the $width x $height frame." }
        require(outWidth > 0 && outHeight > 0) { "The output size is $outWidth x $outHeight." }

        val chromaWidth = width / 2
        val uStart = width * height
        val vStart = uStart + uStart / 4
        // The source column of an output column is the same in each row.
        val sourceX = IntArray(outWidth) { crop.left + (2 * it + 1) * crop.width / (2 * outWidth) }
        val argb = IntArray(outWidth * outHeight)
        for (outY in 0 until outHeight) {
            val y = crop.top + (2 * outY + 1) * crop.height / (2 * outHeight)
            val chromaRow = (y / 2) * chromaWidth
            for (outX in 0 until outWidth) {
                val x = sourceX[outX]
                val c = (i420[y * width + x].toInt() and 0xFF) - 16
                val d = (i420[uStart + chromaRow + x / 2].toInt() and 0xFF) - 128
                val e = (i420[vStart + chromaRow + x / 2].toInt() and 0xFF) - 128
                val r = ((298 * c + 459 * e + 128) shr 8).coerceIn(0, 255)
                val g = ((298 * c - 55 * d - 136 * e + 128) shr 8).coerceIn(0, 255)
                val b = ((298 * c + 541 * d + 128) shr 8).coerceIn(0, 255)
                argb[outY * outWidth + outX] = (0xFF shl 24) or (r shl 16) or (g shl 8) or b
            }
        }
        return argb
    }

    /**
     * Converts the `crop` of the Y plane to gray ARGB pixels, `scale` times as wide and as high, with alpha 0xFF.
     * Each output pixel is a mix of its 4 nearest samples, so a scaled bar keeps a straight edge.
     * The gray is in full range: 16 becomes black, and 235 becomes white.
     */
    fun cropLumaToArgb(i420: ByteArray, width: Int, height: Int, crop: RectPx, scale: Int): IntArray {
        require(scale >= 1) { "The scale is $scale." }
        require(i420.size >= width * height) { "A $width x $height Y plane has ${width * height} bytes. This buffer has ${i420.size}." }
        require(
            crop.left >= 0 &&
                crop.top >= 0 &&
                crop.width > 0 &&
                crop.height > 0 &&
                crop.left + crop.width <= width &&
                crop.top + crop.height <= height
        ) { "The crop $crop is not inside the $width x $height frame." }

        val outWidth = crop.width * scale
        val outHeight = crop.height * scale
        // The place of each output column and row in the crop, in 1/256 of a pixel.
        val sourceX = IntArray(outWidth) { place(it, scale, crop.width) }
        val argb = IntArray(outWidth * outHeight)
        for (outY in 0 until outHeight) {
            val y = place(outY, scale, crop.height)
            val row = (crop.top + (y shr 8)) * width + crop.left
            val nextRow = if ((y shr 8) + 1 < crop.height) row + width else row
            val weightY = y and 0xFF
            for (outX in 0 until outWidth) {
                val x = sourceX[outX] shr 8
                val nextX = if (x + 1 < crop.width) x + 1 else x
                val weightX = sourceX[outX] and 0xFF
                val top = (i420[row + x].toInt() and 0xFF) * (256 - weightX) + (i420[row + nextX].toInt() and 0xFF) * weightX
                val bottom = (i420[nextRow + x].toInt() and 0xFF) * (256 - weightX) + (i420[nextRow + nextX].toInt() and 0xFF) * weightX
                val luma = (top * (256 - weightY) + bottom * weightY + 32768) shr 16
                val gray = ((luma - 16) * 255 / 219).coerceIn(0, 255)
                argb[outY * outWidth + outX] = (0xFF shl 24) or (gray shl 16) or (gray shl 8) or gray
            }
        }
        return argb
    }

    /** The center of output pixel `out` in source pixels times 256, kept inside the `size` source pixels. */
    private fun place(out: Int, scale: Int, size: Int): Int = ((2 * out + 1) * 256 / (2 * scale) - 128).coerceIn(0, (size - 1) * 256)
}
