package com.metaglance.android.pipeline

import android.graphics.Bitmap
import com.metaglance.core.image.FaceResult
import com.metaglance.core.image.FrameGeometry
import com.metaglance.core.image.Pixelate
import java.io.ByteArrayOutputStream

/** A still photo that is ready for the upload: a JPEG of `width` x `height` pixels. */
class PreparedStill(val jpeg: ByteArray, val width: Int, val height: Int)

/**
 * Prepares a still photo for the upload, with each face pixelated. The photo is never written to storage.
 *
 * The still of the sharp second look has the same crop as a frame of the stream, and a long side of 1440 pixels
 * at most. The still of a barcode has no crop, because the code can be at the edge, and a long side of 1600
 * pixels at most.
 */
object StillPhoto {
    private const val MAX_LONG_SIDE = 1440
    private const val MAX_LABEL_LONG_SIDE = 1600
    private const val JPEG_QUALITY = 85

    /** Returns a bitmap that `getPixels` and ML Kit can read: a hardware bitmap gives a copy. */
    fun readable(photo: Bitmap): Bitmap = if (photo.config == Bitmap.Config.HARDWARE) photo.copy(Bitmap.Config.ARGB_8888, false) else photo

    /**
     * Returns null when face detection did not give a result: a photo that can show a face does not leave the
     * phone. `findFaces` blocks, so do not call this function on the main thread.
     */
    fun prepare(photo: Bitmap, findFaces: (Bitmap) -> FaceResult): PreparedStill? = prepare(photo, findFaces, crop = true, MAX_LONG_SIDE)

    /** The same for the still of a barcode: the full photo, for the frame kind `label`. */
    fun prepareLabel(photo: Bitmap, findFaces: (Bitmap) -> FaceResult): PreparedStill? = prepare(photo, findFaces, crop = false, MAX_LABEL_LONG_SIDE)

    private fun prepare(photo: Bitmap, findFaces: (Bitmap) -> FaceResult, crop: Boolean, maxLongSide: Int): PreparedStill? {
        val source = readable(photo)
        val faces = findFaces(source) as? FaceResult.Found ?: return null

        val rect = if (crop) FrameGeometry.centerCrop(source.width, source.height) else FrameGeometry.full(source.width, source.height)
        val (width, height) = FrameGeometry.outputSize(rect, maxLongSide)
        val cropped = Bitmap.createBitmap(source, rect.left, rect.top, rect.width, rect.height)
        val scaled = if (width == rect.width && height == rect.height) cropped else Bitmap.createScaledBitmap(cropped, width, height, true)
        val argb = IntArray(width * height)
        scaled.getPixels(argb, 0, width, 0, 0, width, height)
        if (scaled !== cropped) scaled.recycle()
        // With no crop, createBitmap can return the source itself.
        if (cropped !== source) cropped.recycle()

        Pixelate.apply(argb, width, height, faces.boxes.mapNotNull { FrameGeometry.mapBox(it, rect, width, height) })
        val output = Bitmap.createBitmap(argb, width, height, Bitmap.Config.ARGB_8888)
        val jpeg = ByteArrayOutputStream().also { output.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, it) }.toByteArray()
        output.recycle()
        return PreparedStill(jpeg, width, height)
    }
}
