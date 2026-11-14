package com.metaglance.android.pipeline

import android.graphics.Bitmap
import com.metaglance.core.barcode.CodeChoice
import com.metaglance.core.barcode.CodeRead
import com.metaglance.core.barcode.TextElement
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
 * Reads the still photo of a barcode on the phone: the scanner first, then the digits. `CodeChoice.ofStill` has
 * the rules for the code of a still.
 */
object LabelStill {
    /** Each of the three steps blocks, so do not call this function on the main thread. */
    fun read(photo: Bitmap, scan: (Bitmap) -> List<CodeHit>, readWords: (Bitmap) -> List<TextElement>, findFaces: (Bitmap) -> FaceResult): LabelOutcome {
        val source = StillPhoto.readable(photo)
        val hits = orNone { scan(source) }.filterNot { it.isQr }.map { it.toProductHit() }
        // OCR also runs when the scanner gave a code: the digits under the bars must not give another code.
        val words = orNone { readWords(source) }
        CodeChoice.ofStill(hits, words, source.width, source.height)?.let { return LabelOutcome.Code(it) }
        return StillPhoto.prepareLabel(source, findFaces)?.let { LabelOutcome.Upload(it) } ?: LabelOutcome.Dropped
    }

    /** A step of ML Kit that fails is a photo with no code. The server can still read the photo. */
    private fun <T> orNone(read: () -> List<T>): List<T> = try {
        read()
    } catch (_: ExecutionException) {
        emptyList()
    }
}
