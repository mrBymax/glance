package com.metaglance.android.pipeline

import android.graphics.Bitmap
import com.metaglance.core.image.FaceResult
import com.metaglance.core.image.FrameGeometry
import com.metaglance.core.image.HeldRegion
import com.metaglance.core.image.Pixelate
import com.metaglance.core.image.RectPx
import java.io.ByteArrayOutputStream

/**
 * A still photo that is ready for the upload: a JPEG of `width` x `height` pixels. `held` is the crop around the
 * product in the hand, in the pixels of the photo of `sourceWidth` x `sourceHeight`, or null. `whole` is true
 * for the photo with no crop.
 */
class PreparedStill(val jpeg: ByteArray, val width: Int, val height: Int, val held: RectPx?, val whole: Boolean, val sourceWidth: Int, val sourceHeight: Int)

/**
 * Prepares a still photo for the upload, with each face pixelated. The photo is never written to storage.
 *
 * The still of the sharp second look has the same crop as a frame of the stream, and a long side of 1440 pixels
 * at most. The still of a barcode has no crop, because the code can be at the edge, and a long side of 1600
 * pixels at most.
 *
 * With `findHeld`, the held crop is on: a photo with a region of a product in a hand goes out as the crop around
 * that region, at the size of the photo, so the label has each pixel of the photo. A photo with no region goes
 * out as before.
 */
object StillPhoto {
    private const val MAX_LONG_SIDE = 1440
    private const val MAX_LABEL_LONG_SIDE = 1600
    private const val JPEG_QUALITY = 85
    private const val HELD_JPEG_QUALITY = 92

    /** Returns a bitmap that `getPixels` and ML Kit can read: a hardware bitmap gives a copy. */
    fun readable(photo: Bitmap): Bitmap = if (photo.config == Bitmap.Config.HARDWARE) photo.copy(Bitmap.Config.ARGB_8888, false) else photo

    /**
     * Returns null when face detection did not give a result: a photo that can show a face does not leave the
     * phone. `findFaces` blocks, so do not call this function on the main thread.
     */
    fun prepare(photo: Bitmap, findHeld: ((Bitmap) -> RectPx?)? = null, findFaces: (Bitmap) -> FaceResult): PreparedStill? = prepare(photo, findFaces, findHeld, crop = true, MAX_LONG_SIDE)

    /** The same for the still of a barcode: the full photo, for the frame kind `label`. */
    fun prepareLabel(photo: Bitmap, findHeld: ((Bitmap) -> RectPx?)? = null, findFaces: (Bitmap) -> FaceResult): PreparedStill? = prepare(photo, findFaces, findHeld, crop = false, MAX_LABEL_LONG_SIDE)

    private fun prepare(photo: Bitmap, findFaces: (Bitmap) -> FaceResult, findHeld: ((Bitmap) -> RectPx?)?, crop: Boolean, maxLongSide: Int): PreparedStill? {
        val source = readable(photo)
        val faces = findFaces(source) as? FaceResult.Found ?: return null

        // The crop rule wants an even size. A photo with an odd side loses its last row or column for the crop.
        val held = findHeld?.invoke(source)?.let { HeldRegion.crop(it, source.width and 1.inv(), source.height and 1.inv()) }
        val rect = held ?: if (crop) FrameGeometry.centerCrop(source.width, source.height) else FrameGeometry.full(source.width, source.height)
        val (width, height) = FrameGeometry.outputSize(rect, if (held != null) MAX_LABEL_LONG_SIDE else maxLongSide)
        val cropped = Bitmap.createBitmap(source, rect.left, rect.top, rect.width, rect.height)
        val scaled = if (width == rect.width && height == rect.height) cropped else Bitmap.createScaledBitmap(cropped, width, height, true)
        val argb = IntArray(width * height)
        scaled.getPixels(argb, 0, width, 0, 0, width, height)
        if (scaled !== cropped) scaled.recycle()
        // With no crop, createBitmap can return the source itself.
        if (cropped !== source) cropped.recycle()

        // A face that ends beside the held crop counts with the margin of `Pixelate`, as in a crop of the stream.
        val boxes = if (held != null) faces.boxes.map(Pixelate::grown) else faces.boxes
        Pixelate.apply(argb, width, height, boxes.mapNotNull { FrameGeometry.mapBox(it, rect, width, height) })
        val output = Bitmap.createBitmap(argb, width, height, Bitmap.Config.ARGB_8888)
        val quality = if (held != null) HELD_JPEG_QUALITY else JPEG_QUALITY
        val jpeg = ByteArrayOutputStream().also { output.compress(Bitmap.CompressFormat.JPEG, quality, it) }.toByteArray()
        output.recycle()
        return PreparedStill(jpeg, width, height, held, whole = held == null && !crop, source.width, source.height)
    }
}
