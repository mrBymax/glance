package com.metaglance.android.pipeline

import android.content.Context
import android.graphics.Bitmap
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.objectdetector.ObjectDetector
import com.metaglance.core.image.DetectedObject
import com.metaglance.core.image.FrameGeometry
import com.metaglance.core.image.HeldRegion
import com.metaglance.core.image.I420
import com.metaglance.core.image.RawFrame
import com.metaglance.core.image.RectPx
import kotlin.math.ceil
import kotlin.math.floor

/**
 * Finds the region of a product that the shopper can hold, on the phone, with the object detector of MediaPipe
 * Tasks and the EfficientDet-Lite0 model of the APK. It uses no network. `HeldRegion` of `core` has the rules
 * for the boxes.
 *
 * The detector gets a copy of the image with a long side of 640 pixels: its model reads 320 x 320 pixels. The
 * region is in the pixels of the image of the caller, and the crop is cut from that image.
 *
 * Each call blocks until the detector is done, so do not call it on the main thread. A call that fails throws
 * a `RuntimeException` of MediaPipe.
 */
class HeldFinder private constructor(private val detector: ObjectDetector) {
    /** The region in the pixels of the frame, or null. */
    fun find(frame: RawFrame): RectPx? {
        val (width, height) = HeldRegion.detectorSize(frame.width, frame.height)
        val argb = I420.cropScaleToArgb(frame.i420, frame.width, frame.height, FrameGeometry.full(frame.width, frame.height), width, height)
        val small = Bitmap.createBitmap(argb, width, height, Bitmap.Config.ARGB_8888)
        try {
            return find(small, frame.width, frame.height)
        } finally {
            small.recycle()
        }
    }

    /** The same for a photo. The photo must be a bitmap that `getPixels` can read: see `StillPhoto.readable`. */
    fun find(photo: Bitmap): RectPx? {
        val (width, height) = HeldRegion.detectorSize(photo.width, photo.height)
        if (width == photo.width && height == photo.height) return find(photo, photo.width, photo.height)
        val small = Bitmap.createScaledBitmap(photo, width, height, true)
        try {
            return find(small, photo.width, photo.height)
        } finally {
            small.recycle()
        }
    }

    fun close() = detector.close()

    private fun find(image: Bitmap, width: Int, height: Int): RectPx? {
        val input = BitmapImageBuilder(image).build()
        val objects = try {
            detector.detect(input).detections().mapNotNull { detection ->
                val category = detection.categories().maxByOrNull { it.score() } ?: return@mapNotNull null
                val box = detection.boundingBox()
                val left = floor(box.left).toInt()
                val top = floor(box.top).toInt()
                DetectedObject(category.categoryName(), category.score(), RectPx(left, top, ceil(box.right).toInt() - left, ceil(box.bottom).toInt() - top))
            }
        } finally {
            input.close()
        }
        return HeldRegion.choose(objects, image.width, image.height)?.let { HeldRegion.toFrame(it, image.width, image.height, width, height) }
    }

    companion object {
        /** The model file in the assets of the APK: EfficientDet-Lite0, 8 bit, with the 80 classes of COCO. */
        const val MODEL_ASSET = "held/efficientdet_lite0.tflite"

        /** More boxes than a frame of the measurement had. `HeldRegion.choose` selects among them. */
        private const val MAX_RESULTS = 25

        /**
         * Loads the model. Returns null, with one log line, when the detector does not start: the app then
         * works with no crop.
         */
        fun open(context: Context, log: (String) -> Unit): HeldFinder? = try {
            val options = ObjectDetector.ObjectDetectorOptions.builder()
                .setBaseOptions(BaseOptions.builder().setModelAssetPath(MODEL_ASSET).build())
                .setRunningMode(RunningMode.IMAGE)
                .setMaxResults(MAX_RESULTS)
                .setScoreThreshold(HeldRegion.MIN_SCORE)
                .build()
            HeldFinder(ObjectDetector.createFromOptions(context, options))
        } catch (e: RuntimeException) {
            log("held crop off: the detector did not start: ${e.message}")
            null
        } catch (e: UnsatisfiedLinkError) {
            log("held crop off: the detector did not start: ${e.message}")
            null
        }
    }
}
