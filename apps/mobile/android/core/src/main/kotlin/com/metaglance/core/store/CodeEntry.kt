package com.metaglance.core.store

import com.metaglance.core.barcode.Gtin

/** The barcode of the product form: a code of 13 digits, or the reason why the text is no code. */
sealed interface CodeEntry {
    data class Code(val gtin13: String) : CodeEntry

    /** `message` says what is wrong and what to do. */
    data class Wrong(val message: String) : CodeEntry

    companion object {
        private val SPACES = Regex("\\s+")
        private val LENGTHS = listOf(8, 12, 13)

        /** Reads digits that a person typed. The digits under a barcode stand in groups, so spaces do not count. */
        fun typed(text: String): CodeEntry {
            val digits = text.replace(SPACES, "")
            return when {
                digits.isEmpty() -> Wrong("Type the digits under the barcode.")
                !digits.all { it in '0'..'9' } -> Wrong("A barcode has digits only.")
                digits.length !in LENGTHS -> Wrong("A barcode has 8, 12, or 13 digits. This one has ${digits.length}.")
                else -> Gtin.normalize(digits)?.let(::Code) ?: Wrong("The check digit is wrong. Read the digits again.")
            }
        }

        /** Reads the text of a barcode scanner. `upcE` is true for the UPC-E format, whose 8 digits are no EAN-8. */
        fun scanned(text: String?, upcE: Boolean): CodeEntry {
            val gtin = text?.let { Gtin.fromDecoder(it, upcE) }?.let { Gtin.normalize(it) }
            return gtin?.let(::Code) ?: Wrong("The scanner read no product code. Scan again, or type the digits.")
        }
    }
}
