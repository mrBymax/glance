package com.metaglance.core.barcode

import com.metaglance.core.contract.BarcodeSource
import com.metaglance.core.image.RectPx

/**
 * One hit of the scanner that is no QR code. `code` is its product code. It is null for a region that did not
 * decode, and for a text with a wrong check digit. `box` is in the pixels of the image.
 */
data class ProductHit(val code: String?, val box: RectPx?)

/**
 * Selects the one product code of an image from the hits of the scanner and the words of OCR.
 * An image with two candidates gives no code: the phone cannot know which one the shopper holds up.
 */
object CodeChoice {
    /** With no barcode region in a photo, only these lengths count: 8 digits anywhere in a photo can be a date. */
    private const val MIN_DIGITS_WITH_NO_REGION = 12

    /** The decoded code with the largest box. The shopper holds one product up, so the largest code is the one to read. */
    fun decoded(hits: List<ProductHit>): String? = hits.filter { it.code != null }.maxByOrNull { area(it.box) }?.code

    /** The largest box with the form of a product barcode, or null. */
    fun region(hits: List<ProductHit>): RectPx? = BarcodeRegion.largest(hits.mapNotNull { it.box }.filter(BarcodeRegion::isLinear))

    /** The code in the words that OCR read in the crop of one region. Two codes are a text that the rules cannot read. */
    fun ofWords(words: List<TextElement>): CodeRead? = TextRows.codes(words).singleOrNull()?.let { CodeRead(it, BarcodeSource.OCR) }

    /**
     * The code of a still photo of `width` x `height` pixels. A still is one image, so no other image can agree
     * with it. A code of the decoder counts with its check digit. The digits count when they give exactly one
     * code: under the region of the photo, or, with no region, in the full photo with 12 or 13 digits.
     */
    fun ofStill(hits: List<ProductHit>, words: List<TextElement>, width: Int, height: Int): CodeRead? {
        decoded(hits)?.let { return CodeRead(it, BarcodeSource.BARCODE) }
        val digitsArea = region(hits)?.let { BarcodeRegion.forDigits(it, width, height) }
        val near = words.filter { word -> digitsArea == null || BarcodeRegion.holds(digitsArea, word.box.left + word.box.width / 2, word.box.top + word.box.height / 2) }
        val codes = TextRows.codes(near).filter { digitsArea != null || it.length >= MIN_DIGITS_WITH_NO_REGION }
        return codes.singleOrNull()?.let { CodeRead(it, BarcodeSource.OCR) }
    }

    private fun area(box: RectPx?): Long = box?.let { it.width.toLong() * it.height } ?: 0
}
