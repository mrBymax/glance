package com.metaglance.android.pipeline

import android.graphics.Bitmap
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import com.metaglance.core.barcode.Gtin
import com.metaglance.core.barcode.ProductHit
import com.metaglance.core.image.RectPx

/**
 * One code that the scanner found in an image. `text` is null for a region that can hold a barcode which the
 * scanner did not decode. `box` is in the pixels of the image.
 */
class CodeHit(val text: String?, val format: Int, val box: RectPx?) {
    val areaPx: Int get() = box?.let { it.width * it.height } ?: 0

    val isQr: Boolean get() = format == Barcode.FORMAT_QR_CODE

    /** The code for `barcode.seen`, or null: a QR code, a region, and a text with a wrong check digit give null. */
    val productCode: String?
        get() = if (format in CodeScanner.PRODUCT_FORMATS) text?.let { Gtin.fromDecoder(it, upcE = format == Barcode.FORMAT_UPC_E) } else null

    /** The hit for the rules of `core`, which know no ML Kit type. */
    fun toProductHit() = ProductHit(productCode, box)

    val formatName: String
        get() = when (format) {
            Barcode.FORMAT_QR_CODE -> "QR"
            Barcode.FORMAT_EAN_13 -> "EAN_13"
            Barcode.FORMAT_EAN_8 -> "EAN_8"
            Barcode.FORMAT_UPC_A -> "UPC_A"
            Barcode.FORMAT_UPC_E -> "UPC_E"
            else -> "UNKNOWN"
        }
}

/**
 * Reads the QR code of a kiosk and the barcode of a product (EAN-13, EAN-8, UPC-A, UPC-E) with ML Kit.
 * It also reports each region that can hold a barcode which it did not decode, so the caller can read that
 * region again in a larger scale.
 */
class CodeScanner {
    private val scanner = BarcodeScanning.getClient(
        BarcodeScannerOptions.Builder()
            .setBarcodeFormats(Barcode.FORMAT_QR_CODE, *PRODUCT_FORMATS)
            .enableAllPotentialBarcodes()
            .build()
    )

    /** Blocks until ML Kit is done. Do not call it on the main thread. */
    fun scan(nv21: ByteArray, width: Int, height: Int): List<CodeHit> = scan(InputImage.fromByteArray(nv21, width, height, 0, InputImage.IMAGE_FORMAT_NV21))

    /** The same for a bitmap. ML Kit does not read a hardware bitmap. */
    fun scan(bitmap: Bitmap): List<CodeHit> = scan(InputImage.fromBitmap(bitmap, 0))

    fun close() = scanner.close()

    private fun scan(image: InputImage): List<CodeHit> = Tasks.await(scanner.process(image)).map { barcode ->
        val box = barcode.boundingBox?.let { RectPx(it.left, it.top, it.width(), it.height()) }
        CodeHit(barcode.rawValue, barcode.format, box)
    }

    companion object {
        val PRODUCT_FORMATS = intArrayOf(Barcode.FORMAT_EAN_13, Barcode.FORMAT_EAN_8, Barcode.FORMAT_UPC_A, Barcode.FORMAT_UPC_E)
    }
}
