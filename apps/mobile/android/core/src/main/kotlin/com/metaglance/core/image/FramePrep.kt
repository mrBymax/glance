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
    fun prepare(frame: RawFrame, faces: FaceResult): PreparedFrame? = full(frame, faces, FULL_MAX_LONG_SIDE)

    /**
     * The context image of a crop: the full frame with a long side of 384 pixels at most, with each face of
     * `Found` pixelated. The server model finds the hand in it and reads nothing, so it is small.
     * Returns null when face detection failed.
     */
    fun context(frame: RawFrame, faces: FaceResult): PreparedFrame? = full(frame, faces, CONTEXT_MAX_LONG_SIDE)

    private fun full(frame: RawFrame, faces: FaceResult, maxLongSide: Int): PreparedFrame? {
        if (faces is FaceResult.Failed) return null
        val rect = FrameGeometry.full(frame.width, frame.height)
        val (outWidth, outHeight) = FrameGeometry.outputSize(rect, maxLongSide)
        val argb = I420.cropScaleToArgb(frame.i420, frame.width, frame.height, rect, outWidth, outHeight)
        if (faces is FaceResult.Found) {
            Pixelate.apply(argb, outWidth, outHeight, faces.boxes.mapNotNull { FrameGeometry.mapBox(it, rect, outWidth, outHeight) })
        }
        return PreparedFrame(argb, outWidth, outHeight, blurred = faces is FaceResult.Found)
    }

    /**
     * Converts the `crop` of one frame for the upload, with the pixels of the frame: no scale, so the print on a
     * product keeps each pixel that the stream has. Only a crop with a long side above 1600 pixels is scaled, and
     * no frame of the stream is that large.
     * The boxes of `faces` are in frame pixels, from a detection on the full frame: a face that the crop cuts
     * is found there, and its part inside the crop is pixelated. A face that ends beside the crop counts with the
     * margin of `Pixelate`, so its edge is not in the output.
     * Returns null when face detection failed.
     */
    fun prepare(frame: RawFrame, faces: FaceResult, crop: RectPx): PreparedFrame? {
        if (faces is FaceResult.Failed) return null
        val (outWidth, outHeight) = FrameGeometry.outputSize(crop, CROP_MAX_LONG_SIDE)
        val argb = I420.cropScaleToArgb(frame.i420, frame.width, frame.height, crop, outWidth, outHeight)
        if (faces is FaceResult.Found) {
            Pixelate.apply(argb, outWidth, outHeight, faces.boxes.mapNotNull { FrameGeometry.mapBox(Pixelate.grown(it), crop, outWidth, outHeight) })
        }
        return PreparedFrame(argb, outWidth, outHeight, blurred = faces is FaceResult.Found)
    }

    /** The limit of a label still. A crop of a stream frame of 720 x 1280 is below it. */
    const val CROP_MAX_LONG_SIDE = 1600

    private const val FULL_MAX_LONG_SIDE = 768

    /** Measured on 2026-11-14: a JPEG of quality 70 at this size has about 13 kB. */
    const val CONTEXT_MAX_LONG_SIDE = 384
}
