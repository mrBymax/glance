package com.metaglance.android.store

import android.content.ContentResolver
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import androidx.exifinterface.media.ExifInterface
import com.metaglance.core.store.PictureScale
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream

/** Makes the JPEG that the phone sends as a reference picture, and the small bitmap of a thumbnail. */
internal object PicturePrep {
    /**
     * Reads a photo of the camera or of the gallery, turns it upright, brings its long side to 1600 pixels, and
     * writes it as a JPEG. A camera writes the turn of the phone into the EXIF data and leaves the pixels as the
     * sensor has them, and the server reads no EXIF data.
     * Throws an [IOException] for a file that does not open or that is no picture. Do not call it on the main thread.
     */
    fun jpeg(resolver: ContentResolver, uri: Uri): ByteArray {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        open(resolver, uri).use { BitmapFactory.decodeStream(it, null, bounds) }
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) throw IOException("The file is no picture.")

        val sampled = BitmapFactory.Options().apply { inSampleSize = PictureScale.sampleSize(bounds.outWidth, bounds.outHeight) }
        val decoded = open(resolver, uri).use { BitmapFactory.decodeStream(it, null, sampled) } ?: throw IOException("The file is no picture.")
        val orientation = open(resolver, uri).use { ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL) }

        val (width, height) = PictureScale.fit(decoded.width, decoded.height)
        val matrix = Matrix()
        matrix.postScale(width.toFloat() / decoded.width, height.toFloat() / decoded.height)
        turnUpright(matrix, orientation)
        val upright = Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, matrix, true)
        val out = ByteArrayOutputStream()
        upright.compress(Bitmap.CompressFormat.JPEG, PictureScale.JPEG_QUALITY, out)
        if (upright !== decoded) upright.recycle()
        decoded.recycle()
        return out.toByteArray()
    }

    /** A bitmap with a long side near `sidePx`, or null for bytes that are no picture. */
    fun thumbnail(jpeg: ByteArray, sidePx: Int): Bitmap? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(jpeg, 0, jpeg.size, bounds)
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
        val sampled = BitmapFactory.Options().apply { inSampleSize = PictureScale.sampleSize(bounds.outWidth, bounds.outHeight, sidePx) }
        return BitmapFactory.decodeByteArray(jpeg, 0, jpeg.size, sampled)
    }

    private fun open(resolver: ContentResolver, uri: Uri): InputStream = resolver.openInputStream(uri) ?: throw IOException("The picture did not open.")

    // The eight values of the EXIF orientation tag: four turns, and each one mirrored.
    private fun turnUpright(matrix: Matrix, orientation: Int) {
        when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(QUARTER)
            ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(2 * QUARTER)
            ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(3 * QUARTER)
            ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.postScale(-1f, 1f)
            ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.postScale(1f, -1f)
            ExifInterface.ORIENTATION_TRANSPOSE -> {
                matrix.postRotate(QUARTER)
                matrix.postScale(-1f, 1f)
            }
            ExifInterface.ORIENTATION_TRANSVERSE -> {
                matrix.postRotate(3 * QUARTER)
                matrix.postScale(-1f, 1f)
            }
        }
    }

    private const val QUARTER = 90f
}
