package com.metaglance.core.image

/**
 * Tells when the size of the stream frames changes. The glasses lower the size when Bluetooth is slow, for
 * example from 720 x 1280 to 504 x 896, and a smaller frame makes each barcode harder to read. So the log
 * must show each change.
 */
class StreamSize {
    private var width = 0
    private var height = 0

    /** Returns one log line for the first frame and for each frame with another size than the frame before it. */
    fun onFrame(width: Int, height: Int): String? {
        if (width == this.width && height == this.height) return null
        this.width = width
        this.height = height
        return "stream size ${width}x$height"
    }
}
