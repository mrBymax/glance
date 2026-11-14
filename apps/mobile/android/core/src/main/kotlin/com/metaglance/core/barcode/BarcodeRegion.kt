package com.metaglance.core.barcode

import com.metaglance.core.image.RectPx

/**
 * The crops of a frame around a barcode that the scanner found and did not decode. `box` is the box of the
 * scanner in frame pixels. Each crop stays inside the frame, and a box with no part in the frame gives null.
 */
object BarcodeRegion {
    /** A scaled crop is at most this wide, so the second decode stays short. */
    private const val MAX_SCALED_WIDTH = 960

    /** The box with the quiet zone that a decoder needs: 15 percent of the width and 25 percent of the height on each side. */
    fun forDecode(box: RectPx, frameWidth: Int, frameHeight: Int): RectPx? = grow(box, frameWidth, frameHeight, below = 0)

    /** The crop for the decoder, and half of the box height more below it: a package prints the digits under the bars. */
    fun forDigits(box: RectPx, frameWidth: Int, frameHeight: Int): RectPx? = grow(box, frameWidth, frameHeight, below = box.height / 2)

    /** The scale of a crop for the second decode and for OCR: 3 for a small crop, else 2. */
    fun scale(crop: RectPx): Int = if (crop.width * 3 <= MAX_SCALED_WIDTH) 3 else 2

    /** The region with the largest area: the code that the shopper holds up is the nearest one. */
    fun largest(boxes: List<RectPx>): RectPx? = boxes.maxByOrNull { it.width.toLong() * it.height }

    /**
     * True for a box whose long side is at least 1.25 times its short side, as the bars of a product barcode.
     * The box of a QR code is square, so a kiosk code that is too far to decode is no region of a product.
     */
    fun isLinear(box: RectPx): Boolean {
        val short = minOf(box.width, box.height)
        return short > 0 && maxOf(box.width, box.height) * 4 >= short * 5
    }

    /** True when the point is inside the crop. */
    fun holds(crop: RectPx, x: Int, y: Int): Boolean = x >= crop.left && x < crop.left + crop.width && y >= crop.top && y < crop.top + crop.height

    private fun grow(box: RectPx, frameWidth: Int, frameHeight: Int, below: Int): RectPx? {
        if (box.width <= 0 || box.height <= 0) return null
        val marginX = box.width * 15 / 100
        val marginY = box.height / 4
        val left = maxOf(box.left - marginX, 0)
        val top = maxOf(box.top - marginY, 0)
        val right = minOf(box.left + box.width + marginX, frameWidth)
        val bottom = minOf(box.top + box.height + marginY + below, frameHeight)
        return if (left < right && top < bottom) RectPx(left, top, right - left, bottom - top) else null
    }
}
