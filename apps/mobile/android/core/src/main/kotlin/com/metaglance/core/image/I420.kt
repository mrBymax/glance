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
}
