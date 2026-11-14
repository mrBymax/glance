package com.metaglance.android.pipeline

import android.graphics.Bitmap
import com.metaglance.core.barcode.BarcodeRegion
import com.metaglance.core.barcode.CodeRead
import com.metaglance.core.barcode.TextElement
import com.metaglance.core.barcode.TextRows
import com.metaglance.core.contract.BarcodeSource
import com.metaglance.core.image.FaceResult
import java.util.concurrent.ExecutionException

/** What the phone does with the still photo of a barcode. */
sealed interface LabelOutcome {
    /** The phone read the code, so the still stays on the phone. */
    class Code(val read: CodeRead) : LabelOutcome

    /** The phone read no code. The server reads the still, as a frame of the kind `label`. */
    class Upload(val still: PreparedStill) : LabelOutcome

    /** Face detection gave no result, so the still does not leave the phone. */
    data object Dropped : LabelOutcome
}

/**
 * Reads the still photo of a barcode on the phone: the scanner first, then the digits. A still is one image, so
 * no other image can agree with it. A code of the decoder counts with its check digit. The digits count when the
 * still holds exactly one code with a right check digit, and with no barcode region only for 12 or 13 digits:
 * 8 digits anywhere in a photo can be a date.
 */
object LabelStill {
    /** Each of the three steps blocks, so do not call this function on the main thread. */
    fun read(photo: Bitmap, scan: (Bitmap) -> List<CodeHit>, readWords: (Bitmap) -> List<TextElement>, findFaces: (Bitmap) -> FaceResult): LabelOutcome {
        val source = StillPhoto.readable(photo)
        code(source, scan, readWords)?.let { return LabelOutcome.Code(it) }
        return StillPhoto.prepareLabel(source, findFaces)?.let { LabelOutcome.Upload(it) } ?: LabelOutcome.Dropped
    }

    private fun code(photo: Bitmap, scan: (Bitmap) -> List<CodeHit>, readWords: (Bitmap) -> List<TextElement>): CodeRead? {
        val hits = orNone { scan(photo) }.filterNot { it.isQr }
        hits.filter { it.productCode != null }.maxByOrNull { it.areaPx }?.productCode?.let { return CodeRead(it, BarcodeSource.BARCODE) }

        val region = BarcodeRegion.largest(hits.mapNotNull { it.box }.filter(BarcodeRegion::isLinear))
        val digitsArea = region?.let { BarcodeRegion.forDigits(it, photo.width, photo.height) }
        val words = orNone { readWords(photo) }.filter { word ->
            digitsArea == null || BarcodeRegion.holds(digitsArea, word.box.left + word.box.width / 2, word.box.top + word.box.height / 2)
        }
        val codes = TextRows.codes(words).filter { digitsArea != null || it.length >= MIN_DIGITS_WITH_NO_REGION }
        return codes.singleOrNull()?.let { CodeRead(it, BarcodeSource.OCR) }
    }

    /** A step of ML Kit that fails is a photo with no code. The server can still read the photo. */
    private fun <T> orNone(read: () -> List<T>): List<T> = try {
        read()
    } catch (_: ExecutionException) {
        emptyList()
    }

    private const val MIN_DIGITS_WITH_NO_REGION = 12
}
