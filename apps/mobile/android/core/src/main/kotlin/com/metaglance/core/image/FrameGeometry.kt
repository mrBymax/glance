package com.metaglance.core.image

import kotlin.math.roundToInt

/** A rectangle in the pixels of a frame. */
data class RectPx(val left: Int, val top: Int, val width: Int, val height: Int)

object FrameGeometry {
    fun full(width: Int, height: Int) = RectPx(0, 0, width, height)

    /**
     * The center 80 percent of the width and 70 percent of the height.
     * Each of the four values is even, so the crop starts on a chroma sample of an I420 frame.
     */
    fun centerCrop(width: Int, height: Int): RectPx {
        val cropWidth = even(width * 8 / 10)
        val cropHeight = even(height * 7 / 10)
        return RectPx(even((width - cropWidth) / 2), even((height - cropHeight) / 2), cropWidth, cropHeight)
    }

    /**
     * The size of the upload for a crop. A long side of more than `maxLongSide` is scaled to it,
     * and each side is rounded to the nearest even number. A smaller crop keeps its size.
     */
    fun outputSize(crop: RectPx, maxLongSide: Int = 768): Pair<Int, Int> {
        val longSide = maxOf(crop.width, crop.height)
        if (longSide <= maxLongSide) return crop.width to crop.height
        val scale = maxLongSide.toDouble() / longSide
        return nearestEven(crop.width * scale) to nearestEven(crop.height * scale)
    }

    /**
     * Maps a box in frame pixels to the pixels of the output: the part of the box inside `crop`, scaled to
     * `outWidth` x `outHeight`. The left and top edges are rounded down, and the right and bottom edges up,
     * so the result never covers less than the box. Returns null for a box outside the crop.
     */
    fun mapBox(box: RectPx, crop: RectPx, outWidth: Int, outHeight: Int): RectPx? {
        val left = maxOf(box.left, crop.left) - crop.left
        val top = maxOf(box.top, crop.top) - crop.top
        val right = minOf(box.left + box.width, crop.left + crop.width) - crop.left
        val bottom = minOf(box.top + box.height, crop.top + crop.height) - crop.top
        if (left >= right || top >= bottom) return null
        val outLeft = left * outWidth / crop.width
        val outTop = top * outHeight / crop.height
        val outRight = ceilDiv(right * outWidth, crop.width)
        val outBottom = ceilDiv(bottom * outHeight, crop.height)
        return RectPx(outLeft, outTop, outRight - outLeft, outBottom - outTop)
    }

    private fun ceilDiv(value: Int, divisor: Int) = (value + divisor - 1) / divisor

    private fun even(value: Int) = value and 1.inv()

    private fun nearestEven(value: Double) = 2 * (value / 2).roundToInt()
}
