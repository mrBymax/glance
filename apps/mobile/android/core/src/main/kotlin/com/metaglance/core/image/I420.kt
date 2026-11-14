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
}
