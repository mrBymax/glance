package com.metaglance.android.pipeline

import android.graphics.Bitmap
import com.metaglance.core.barcode.BarcodeRegion
import com.metaglance.core.image.I420
import com.metaglance.core.image.RawFrame
import com.metaglance.core.image.RectPx

/**
 * Returns the `crop` of a frame as a gray bitmap, 2 or 3 times as large (`BarcodeRegion.scale`). The scanner
 * and OCR read a small barcode region better in this scale. Recycle the bitmap after the read.
 */
fun RawFrame.regionBitmap(crop: RectPx): Bitmap {
    val scale = BarcodeRegion.scale(crop)
    val argb = I420.cropLumaToArgb(i420, width, height, crop, scale)
    return Bitmap.createBitmap(argb, crop.width * scale, crop.height * scale, Bitmap.Config.ARGB_8888)
}
