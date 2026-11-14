package com.metaglance.android.pipeline

import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage

class QrHit(val text: String, val areaPx: Int)

/** Reads QR codes with ML Kit. No other barcode format is enabled. */
class QrScanner {
    private val scanner = BarcodeScanning.getClient(
        BarcodeScannerOptions.Builder().setBarcodeFormats(Barcode.FORMAT_QR_CODE).build()
    )

    /** Blocks until ML Kit is done. Do not call it on the main thread. */
    fun scan(nv21: ByteArray, width: Int, height: Int): List<QrHit> {
        val image = InputImage.fromByteArray(nv21, width, height, 0, InputImage.IMAGE_FORMAT_NV21)
        return Tasks.await(scanner.process(image)).mapNotNull { barcode ->
            val text = barcode.rawValue ?: return@mapNotNull null
            val box = barcode.boundingBox
            QrHit(text, if (box == null) 0 else box.width() * box.height())
        }
    }

    fun close() = scanner.close()
}
