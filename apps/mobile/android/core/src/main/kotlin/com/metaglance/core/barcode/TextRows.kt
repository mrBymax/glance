package com.metaglance.core.barcode

import com.metaglance.core.image.RectPx

/** One word of an OCR result, with its box in the pixels of the image. */
data class TextElement(val text: String, val box: RectPx)

/**
 * Puts the words of an OCR result into rows. OCR can give the digit groups under a barcode as words of
 * different lines, for example the first digit of an EAN-13 code, which stands left of the bars.
 */
object TextRows {
    /**
     * Returns the texts of each row from left to right, and the rows from top to bottom.
     * A word is in a row when the vertical center of one of the two is inside the height of the other.
     */
    fun rows(elements: List<TextElement>): List<List<String>> {
        val rows = mutableListOf<MutableList<TextElement>>()
        // The tallest word of a row comes first, so a small word finds the row of its tall neighbours.
        for (element in elements.sortedByDescending { it.box.height }) {
            val row = rows.firstOrNull { sameRow(it.first().box, element.box) }
            if (row == null) rows += mutableListOf(element) else row += element
        }
        return rows.sortedBy { it.first().box.top }.map { row -> row.sortedBy { it.box.left }.map { it.text } }
    }

    /** Returns each product code in the rows, as `Gtin.digitRuns` reads them. */
    fun codes(elements: List<TextElement>): List<String> = rows(elements).flatMap { Gtin.digitRuns(it) }.distinct()

    private fun sameRow(a: RectPx, b: RectPx): Boolean {
        val centerA = a.top + a.height / 2
        val centerB = b.top + b.height / 2
        return centerB in a.top..(a.top + a.height) || centerA in b.top..(b.top + b.height)
    }
}
