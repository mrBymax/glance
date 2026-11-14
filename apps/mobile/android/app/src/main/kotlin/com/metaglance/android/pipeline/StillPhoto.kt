package com.metaglance.android.pipeline

import android.graphics.Bitmap
import com.metaglance.core.image.FaceResult
import com.metaglance.core.image.FrameGeometry
import com.metaglance.core.image.Pixelate
import java.io.ByteArrayOutputStream

/** A still photo that is ready for the upload: a JPEG of `width` x `height` pixels. */
class PreparedStill(val jpeg: ByteArray, val width: Int, val height: Int)

/**
 * Prepares the still photo of the sharp second look: the same crop as a frame of the stream, a long side of
 * 1440 pixels at most, and each face pixelated. The photo is never written to storage.
 */
object StillPhoto {
    private const val MAX_LONG_SIDE = 1440
    private const val JPEG_QUALITY = 85

    /**
     * Returns null when face detection did not give a result: a photo that can show a face does not leave the
     * phone. `findFaces` blocks, so do not call this function on the main thread.
     */
    fun prepare(photo: Bitmap, findFaces: (Bitmap) -> FaceResult): PreparedStill? {
        // getPixels does not read a hardware bitmap.
        val source = if (photo.config == Bitmap.Config.HARDWARE) photo.copy(Bitmap.Config.ARGB_8888, false) else photo
        val faces = findFaces(source) as? FaceResult.Found ?: return null

        val crop = FrameGeometry.centerCrop(source.width, source.height)
        val (width, height) = FrameGeometry.outputSize(crop, MAX_LONG_SIDE)
        val cropped = Bitmap.createBitmap(source, crop.left, crop.top, crop.width, crop.height)
        val scaled = if (width == crop.width && height == crop.height) cropped else Bitmap.createScaledBitmap(cropped, width, height, true)
        val argb = IntArray(width * height)
        scaled.getPixels(argb, 0, width, 0, 0, width, height)
        if (scaled !== cropped) scaled.recycle()
        cropped.recycle()

        Pixelate.apply(argb, width, height, faces.boxes.mapNotNull { FrameGeometry.mapBox(it, crop, width, height) })
        val output = Bitmap.createBitmap(argb, width, height, Bitmap.Config.ARGB_8888)
        val jpeg = ByteArrayOutputStream().also { output.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, it) }.toByteArray()
        output.recycle()
        return PreparedStill(jpeg, width, height)
    }
}
