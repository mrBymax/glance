package com.metaglance.core.barcode

import com.metaglance.core.contract.BarcodeSource
import com.metaglance.core.image.RectPx
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CodeChoiceTest {
    private val pasta = "8076809513753"
    private val pens = "4006381333931"
    private val bars = RectPx(1000, 1000, 600, 300)

    private fun word(text: String, left: Int, top: Int, width: Int = 240) = TextElement(text, RectPx(left, top, width, 50))

    /** The digits of `pasta` in the three groups of a package, under `bars`. */
    private val pastaDigits = listOf(word("8", 960, 1320, width = 30), word("076809", 1050, 1320), word("513753", 1330, 1320))

    @Test fun `the largest decoded code of a frame is the one to read`() {
        val hits = listOf(ProductHit(pens, RectPx(0, 0, 100, 50)), ProductHit(pasta, RectPx(300, 300, 200, 90)), ProductHit(null, RectPx(0, 500, 600, 300)))
        assertEquals(pasta, CodeChoice.decoded(hits))
        assertEquals(pens, CodeChoice.decoded(listOf(ProductHit(pens, null))))
        assertNull(CodeChoice.decoded(listOf(ProductHit(null, bars))))
        assertNull(CodeChoice.decoded(emptyList()))
    }

    @Test fun `the region of a frame is its largest box with the form of a barcode`() {
        val square = RectPx(0, 0, 480, 480)
        val small = RectPx(0, 600, 100, 50)
        assertEquals(bars, CodeChoice.region(listOf(ProductHit(null, square), ProductHit(null, small), ProductHit(null, bars), ProductHit(null, null))))
        assertNull(CodeChoice.region(listOf(ProductHit(null, square))))
        assertNull(CodeChoice.region(emptyList()))
    }

    @Test fun `the words of a region give a code when they hold exactly one`() {
        assertEquals(CodeRead(pasta, BarcodeSource.OCR), CodeChoice.ofWords(pastaDigits))
        assertNull(CodeChoice.ofWords(pastaDigits + word(pens, 1000, 1500, width = 500)))
        assertNull(CodeChoice.ofWords(listOf(word("8076809513758", 1000, 1320, width = 500))))
        assertNull(CodeChoice.ofWords(emptyList()))
    }

    @Test fun `a decoded code of a still counts when the digits under it agree, and with no digits`() {
        val hits = listOf(ProductHit(pasta, bars))
        assertEquals(CodeRead(pasta, BarcodeSource.BARCODE), CodeChoice.ofStill(hits, pastaDigits, 4000, 3000))
        assertEquals(CodeRead(pasta, BarcodeSource.BARCODE), CodeChoice.ofStill(hits, emptyList(), 4000, 3000))
        // The digits of another product at the edge of the photo say nothing about this code.
        assertEquals(CodeRead(pasta, BarcodeSource.BARCODE), CodeChoice.ofStill(hits, listOf(word(pens, 100, 100, width = 500)), 4000, 3000))
    }

    // ML Kit gave the code 3777654524301 for blurred bars of 3017624010701, with a right check digit.
    @Test fun `a decoded code of a still with other digits under it gives no code`() {
        assertNull(CodeChoice.ofStill(listOf(ProductHit(pens, bars)), pastaDigits, 4000, 3000))
    }

    @Test fun `the 12 digits of a decoder and the same code with 13 digits under it agree`() {
        val hits = listOf(ProductHit("036000291452", bars))
        assertEquals(CodeRead("036000291452", BarcodeSource.BARCODE), CodeChoice.ofStill(hits, listOf(word("0036000291452", 1000, 1320, width = 500)), 4000, 3000))
    }

    @Test fun `the digits under the region of a still count, and other digits of the photo do not`() {
        val hits = listOf(ProductHit(null, bars))
        val words = pastaDigits + word(pens, 100, 100, width = 500)
        assertEquals(CodeRead(pasta, BarcodeSource.OCR), CodeChoice.ofStill(hits, words, 4000, 3000))
        assertNull(CodeChoice.ofStill(hits, listOf(word(pens, 100, 100, width = 500)), 4000, 3000))
    }

    @Test fun `two codes under the region of a still give no code`() {
        val hits = listOf(ProductHit(null, bars))
        assertNull(CodeChoice.ofStill(hits, pastaDigits + word(pens, 1000, 1250, width = 500), 4000, 3000))
    }

    @Test fun `a still with no region gives a code of 12 or 13 digits only`() {
        assertEquals(CodeRead(pasta, BarcodeSource.OCR), CodeChoice.ofStill(emptyList(), pastaDigits, 4000, 3000))
        assertEquals(CodeRead("036000291452", BarcodeSource.OCR), CodeChoice.ofStill(emptyList(), listOf(word("036000291452", 10, 10)), 4000, 3000))
        // 8 digits anywhere in a photo can be a date.
        assertNull(CodeChoice.ofStill(emptyList(), listOf(word("73513537", 10, 10)), 4000, 3000))
        // A square box is no region of a product barcode.
        assertNull(CodeChoice.ofStill(listOf(ProductHit(null, RectPx(0, 0, 480, 480))), listOf(word("73513537", 10, 10)), 4000, 3000))
    }

    @Test fun `two codes in a still with no region give no code`() {
        assertNull(CodeChoice.ofStill(emptyList(), pastaDigits + word(pens, 100, 100, width = 500), 4000, 3000))
    }

    @Test fun `8 digits under the region of a still count`() {
        val hits = listOf(ProductHit(null, bars))
        assertEquals(CodeRead("73513537", BarcodeSource.OCR), CodeChoice.ofStill(hits, listOf(word("73513537", 1100, 1320)), 4000, 3000))
    }
}
