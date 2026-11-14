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
    fun decoded(hits: List<ProductHit>): String? = decodedHit(hits)?.code

    /** The largest box with the form of a product barcode, and with a size that a code which did not decode can have, or null. */
    fun region(hits: List<ProductHit>, width: Int, height: Int): RectPx? = BarcodeRegion.largest(hits.mapNotNull { it.box }.filter { BarcodeRegion.isLinear(it) && BarcodeRegion.fits(it, width, height) })

    /** The code in the words that OCR read in the crop of one region. Two codes are a text that the rules cannot read. */
    fun ofWords(words: List<TextElement>): CodeRead? = TextRows.codes(words).singleOrNull()?.let { CodeRead(it, BarcodeSource.OCR) }

    /**
     * The code of a still photo of `width` x `height` pixels. A still is one image, so no other image can agree
     * with it. A code of the decoder counts with its check digit, unless the digits under its bars give another
     * code: the decoder can read blurred bars as a wrong code with a right check digit. With no decoded code, the
     * digits count when they give exactly one code: under the region of the photo, or, with no region, in the
     * full photo with 12 or 13 digits.
     */
    fun ofStill(hits: List<ProductHit>, words: List<TextElement>, width: Int, height: Int): CodeRead? {
        val decoded = decodedHit(hits)
        if (decoded?.code != null) {
            val printed = decoded.box?.let { codesIn(BarcodeRegion.forDigits(it, width, height), words) }.orEmpty()
            val agree = printed.isEmpty() || printed.any { Gtin.normalize(it) == Gtin.normalize(decoded.code) }
            return if (agree) CodeRead(decoded.code, BarcodeSource.BARCODE) else null
        }
        val digitsArea = region(hits, width, height)?.let { BarcodeRegion.forDigits(it, width, height) }
        val codes = if (digitsArea != null) codesIn(digitsArea, words) else TextRows.codes(words).filter { it.length >= MIN_DIGITS_WITH_NO_REGION }
        return codes.singleOrNull()?.let { CodeRead(it, BarcodeSource.OCR) }
    }

    private fun decodedHit(hits: List<ProductHit>): ProductHit? = hits.filter { it.code != null }.maxByOrNull { area(it.box) }

    /** The codes in the words whose center is inside `crop`. A null crop holds no word. */
    private fun codesIn(crop: RectPx?, words: List<TextElement>): List<String> {
        if (crop == null) return emptyList()
        return TextRows.codes(words.filter { BarcodeRegion.holds(crop, it.box.left + it.box.width / 2, it.box.top + it.box.height / 2) })
    }

    private fun area(box: RectPx?): Long = box?.let { it.width.toLong() * it.height } ?: 0
}
