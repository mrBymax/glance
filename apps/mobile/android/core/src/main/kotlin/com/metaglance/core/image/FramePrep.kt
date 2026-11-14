package com.metaglance.core.image

/** The result of face detection on one frame. The boxes of `Found` are in frame pixels. */
sealed interface FaceResult {
    data object NotRun : FaceResult

    data object Failed : FaceResult

    data class Found(val boxes: List<RectPx>) : FaceResult
}

/** One frame that is ready for the JPEG encoder. `argb` has `width * height` pixels in rows. */
class PreparedFrame(val argb: IntArray, val width: Int, val height: Int, val blurred: Boolean)

object FramePrep {
    /**
     * Scales and converts one frame for the upload. The output size follows the size of each frame,
     * because the glasses can lower the resolution during a stream.
     * The output is the full frame. A center crop cut off a product that the shopper held at chest height:
     * it was at the lower edge of the frame in the test of 2026-11-14.
     * Each face of `Found` is pixelated in the output.
     * Returns null when face detection failed: a frame that can show a face does not leave the phone.
     */
    fun prepare(frame: RawFrame, faces: FaceResult): PreparedFrame? {
        if (faces is FaceResult.Failed) return null
        val rect = FrameGeometry.full(frame.width, frame.height)
        val (outWidth, outHeight) = FrameGeometry.outputSize(rect)
        val argb = I420.cropScaleToArgb(frame.i420, frame.width, frame.height, rect, outWidth, outHeight)
        if (faces is FaceResult.Found) {
            Pixelate.apply(argb, outWidth, outHeight, faces.boxes.mapNotNull { FrameGeometry.mapBox(it, rect, outWidth, outHeight) })
        }
        return PreparedFrame(argb, outWidth, outHeight, blurred = faces is FaceResult.Found)
    }
}
