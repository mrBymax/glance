package com.metaglance.core.image

/** Hides a part of an image behind large blocks of one color each. */
object Pixelate {
    private const val MIN_BLOCK_PX = 8
    private const val BLOCKS_PER_BOX = 6
    private const val GROW_PERCENT = 20

    /**
     * Pixelates each box of `argb` in place. `argb` has `width * height` pixels in rows.
     *
     * Each box grows by 20 percent of its size on each side, and the image clips it. The block size is one sixth
     * of the box width before it grows, and 8 pixels at least. The blocks start at the left and top edge of the
     * grown box, and each block gets the color of its center pixel.
     */
    fun apply(argb: IntArray, width: Int, height: Int, boxes: List<RectPx>) {
        require(argb.size >= width * height) { "A $width x $height image has ${width * height} pixels. This array has ${argb.size}." }
        for (box in boxes) {
            if (box.width <= 0 || box.height <= 0) continue
            val growX = box.width * GROW_PERCENT / 100
            val growY = box.height * GROW_PERCENT / 100
            val left = (box.left - growX).coerceAtLeast(0)
            val top = (box.top - growY).coerceAtLeast(0)
            val right = (box.left + box.width + growX).coerceAtMost(width)
            val bottom = (box.top + box.height + growY).coerceAtMost(height)
            if (left >= right || top >= bottom) continue
            val block = maxOf(MIN_BLOCK_PX, box.width / BLOCKS_PER_BOX)
            for (blockTop in top until bottom step block) {
                val blockBottom = minOf(blockTop + block, bottom)
                for (blockLeft in left until right step block) {
                    val blockRight = minOf(blockLeft + block, right)
                    val color = argb[(blockTop + blockBottom) / 2 * width + (blockLeft + blockRight) / 2]
                    for (y in blockTop until blockBottom) argb.fill(color, y * width + blockLeft, y * width + blockRight)
                }
            }
        }
    }
}
