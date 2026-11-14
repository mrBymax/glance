package com.metaglance.core.barcode

import com.metaglance.core.image.RectPx
import org.junit.Assert.assertEquals
import org.junit.Test

class TextRowsTest {
    private fun word(text: String, left: Int, top: Int, width: Int = 40, height: Int = 20) = TextElement(text, RectPx(left, top, width, height))

    @Test fun `joins the digit groups of one row from left to right`() {
        val elements = listOf(word("513753", 200, 402), word("8", 10, 400), word("076809", 100, 398))
        assertEquals(listOf("8076809513753"), TextRows.codes(elements))
    }

    @Test fun `keeps two rows apart`() {
        val elements = listOf(word("8", 10, 400), word("076809", 100, 400), word("513753", 200, 440))
        assertEquals(emptyList<String>(), TextRows.codes(elements))
    }

    @Test fun `reads the rows from top to bottom`() {
        val elements = listOf(word("4006381333931", 10, 300, width = 200), word("Pasta", 10, 100), word("73513537", 10, 200, width = 120))
        assertEquals(listOf(listOf("Pasta"), listOf("73513537"), listOf("4006381333931")), TextRows.rows(elements))
        assertEquals(listOf("73513537", "4006381333931"), TextRows.codes(elements))
    }

    @Test fun `a small digit beside tall digits is in their row`() {
        val elements = listOf(word("8", 10, 410, width = 12, height = 14), word("076809", 100, 400, height = 30), word("513753", 200, 400, height = 30))
        assertEquals(listOf("8076809513753"), TextRows.codes(elements))
    }

    @Test fun `gives no code for no text`() {
        assertEquals(emptyList<String>(), TextRows.codes(emptyList()))
    }
}
