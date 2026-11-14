package com.metaglance.core.image

import com.metaglance.core.frame.FrameCrop
import com.metaglance.core.frame.FrameHeader
import com.metaglance.core.frame.FrameSize
import com.metaglance.core.frame.FrameView

/** One object that the detector found: the name of its class, its score from 0 to 1, and its box in the pixels of the detector image. */
data class DetectedObject(val label: String, val score: Float, val box: RectPx)

/**
 * The rules for the crop of the product that the shopper holds. The detector of the app is a general object
 * detector (EfficientDet-Lite0 with the 80 classes of COCO). It knows no hand, so the rule for "held" is the size:
 * a product at the length of an arm fills more of the frame than a product on a table or a shelf.
 *
 * The numbers come from 146 labeled frames and 3904 frames with a server result of 2026-11-14. See "The crop of
 * the held product" in the README of the app. The server stays the judge of "held".
 */
object HeldRegion {
    /** The default of `glance.heldCrop` in the build of the app. */
    const val DEFAULT_ON = true

    /** The classes that a product in a hand got in the measurement, and the food classes. A can has no class of its own: it is a `cup` or a `bottle`. */
    val LABELS = setOf(
        "cup",
        "bottle",
        "wine glass",
        "vase",
        "bowl",
        "banana",
        "apple",
        "sandwich",
        "orange",
        "broccoli",
        "carrot",
        "hot dog",
        "pizza",
        "donut",
        "cake"
    )

    /** The lowest score of a box that counts. The boxes of the held can had 0.16 to 0.74. */
    const val MIN_SCORE = 0.15f

    /** A box counts from this share of the image area. The cans on the tables of the test room were smaller. */
    const val MIN_AREA_PERCENT = 3

    /** A larger box is no product in a hand: the detector gives such a box for a table or a screen. */
    const val MAX_AREA_PERCENT = 50

    /** The crop adds this share of the box on each side: the rest of the product, and the fingers. */
    const val MARGIN_PERCENT = 30

    /** The shortest side of a crop, so a small box gives no picture of a few pixels. */
    const val MIN_SIDE_PX = 224

    /** The long side of the image that the detector gets. Its model reads 320 x 320 pixels. */
    const val DETECTOR_LONG_SIDE = 640

    fun logLine(on: Boolean): String = "held crop: ${state(on)}"

    /** The item of "Glance Mock". */
    fun menuLabel(on: Boolean): String = "Held crop: ${state(on)}"

    private fun state(on: Boolean) = if (on) "on" else "off"

    /** The size of the detector image for a frame or a photo: the long side is 640 pixels at most, and each side is even. */
    fun detectorSize(width: Int, height: Int): Pair<Int, Int> = FrameGeometry.outputSize(FrameGeometry.full(width, height), DETECTOR_LONG_SIDE)

    /**
     * The box of the object that can be a product in a hand, in the pixels of the detector image, or null.
     * It is the largest box of a class of [LABELS] with a score of [MIN_SCORE] that fills 3 to 50 percent of the image.
     * The image clips each box.
     */
    fun choose(objects: List<DetectedObject>, width: Int, height: Int): RectPx? = objects
        .filter { it.score >= MIN_SCORE && it.label in LABELS }
        .mapNotNull { FrameGeometry.mapBox(it.box, FrameGeometry.full(width, height), width, height) }
        .filter { box ->
            val area = box.width.toLong() * box.height
            area * 100 >= MIN_AREA_PERCENT.toLong() * width * height && area * 100 <= MAX_AREA_PERCENT.toLong() * width * height
        }
        .maxByOrNull { it.width.toLong() * it.height }

    /** Maps a box of the detector image to the pixels of the frame. The result never covers less than the box. */
    fun toFrame(box: RectPx, detectorWidth: Int, detectorHeight: Int, width: Int, height: Int): RectPx {
        val mapped = FrameGeometry.mapBox(box, FrameGeometry.full(detectorWidth, detectorHeight), width, height)
        return checkNotNull(mapped) { "The box $box is outside the detector image." }
    }

    /**
     * The crop of a frame for a region: the region with 30 percent more on each side. Its short side is half of
     * its long side at least, and 224 pixels at least. A crop that reaches over an edge moves into the frame and
     * keeps its size. Each of the four values is even, so the crop starts on a chroma sample of an I420 frame.
     * The frame must have an even width and height.
     */
    fun crop(region: RectPx, width: Int, height: Int): RectPx {
        val wide = region.width + 2 * (region.width * MARGIN_PERCENT / 100)
        val high = region.height + 2 * (region.height * MARGIN_PERCENT / 100)
        val cropWidth = minOf(even(maxOf(wide, high / 2, MIN_SIDE_PX)), width)
        val cropHeight = minOf(even(maxOf(high, wide / 2, MIN_SIDE_PX)), height)
        val left = even((2 * region.left + region.width - cropWidth) / 2).coerceIn(0, width - cropWidth)
        val top = even((2 * region.top + region.height - cropHeight) / 2).coerceIn(0, height - cropHeight)
        return RectPx(left, top, cropWidth, cropHeight)
    }

    private fun even(value: Int) = value and 1.inv()
}

/** The header of an upload of a phone that crops: the view, the place of the crop in the source image, and the size of that image. */
fun FrameHeader.withView(crop: RectPx?, sourceWidth: Int, sourceHeight: Int): FrameHeader = copy(
    view = if (crop == null) FrameView.FULL else FrameView.CROP,
    crop = crop?.let { FrameCrop(it.left, it.top, it.width, it.height) },
    source = FrameSize(sourceWidth, sourceHeight)
)

/**
 * Selects what the phone uploads for a picked frame while the held crop is on. A frame with a region goes out as
 * a crop. With no region, the full frame goes out one time each [fullEveryMs], counted from the last upload of
 * each view: the safety net for a product that the detector does not find.
 *
 * A full frame between two crops would end their row for the rules of the server, which want 2 equal results in a
 * row. So it waits until no crop went out for [fullEveryMs].
 */
class HeldUploads(private val fullEveryMs: Long = FULL_EVERY_MS) {
    private var lastUploadMs: Long? = null

    /** Returns the view of the upload, and counts it. Returns null for a frame that stays on the phone. */
    fun next(nowMs: Long, region: Boolean): FrameView? {
        val last = lastUploadMs
        if (!region && last != null && nowMs - last < fullEveryMs) return null
        lastUploadMs = nowMs
        return if (region) FrameView.CROP else FrameView.FULL
    }

    companion object {
        const val FULL_EVERY_MS = 1000L
    }
}

/** The numbers of the held crop for the `frame path` line of the log. One thread uses it. */
class HeldCounts {
    private var frames = 0
    private var withRegion = 0
    private var full = 0
    private val crops = ArrayList<Pair<Int, Int>>()

    /** Call it for each frame that went through the detector. */
    fun onFrame(region: Boolean) {
        frames += 1
        if (region) withRegion += 1
    }

    /** Call it for each upload, with the size of its JPEG. */
    fun onUpload(view: FrameView, width: Int, height: Int) {
        if (view == FrameView.CROP) crops += width to height else full += 1
    }

    /** The part of the line for the time since the last call. The median crop is the one with the median area. */
    fun takeLine(): String {
        val median = crops.sortedBy { it.first.toLong() * it.second }.getOrNull(crops.size / 2)
        val line = "held $withRegion of $frames frames, crop ${crops.size}x, full ${full}x" + (median?.let { ", median crop ${it.first}x${it.second}" } ?: "")
        frames = 0
        withRegion = 0
        full = 0
        crops.clear()
        return line
    }
}
