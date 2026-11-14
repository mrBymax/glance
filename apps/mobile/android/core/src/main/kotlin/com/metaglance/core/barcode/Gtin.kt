package com.metaglance.core.barcode

/** The rules of `gtin.ts` in `packages/shared`, and the codes in the text of an OCR result. */
object Gtin {
    private val UPC_E = Regex("^[01][0-9]{7}$")
    private val SPACES = Regex("[ \\t]+")
    private val CODE_LENGTHS = setOf(8, 12, 13)
    private const val GTIN_13 = 13

    private class Span(val from: Int, val to: Int, val code: String)

    private fun isDigits(text: String): Boolean = text.isNotEmpty() && text.all { it in '0'..'9' }

    /**
     * The GS1 check of EAN-8, UPC-A, EAN-13, and GTIN-14: from the right, the digits count 1, 3, 1, 3,
     * and the sum must end in 0. It does not check the length. Text that is not digits fails.
     */
    fun hasGs1CheckDigit(code: String): Boolean {
        if (!isDigits(code)) return false
        val sum = code.reversed().withIndex().sumOf { (index, char) -> (char - '0') * if (index % 2 == 0) 1 else 3 }
        return sum % 10 == 0
    }

    /**
     * Returns the 12 digits of the UPC-A form of a UPC-E code, or null when the text is not UPC-E.
     * UPC-E has 8 digits: the number system 0 or 1, 6 digits, and the check digit of the UPC-A form.
     * It does not check the check digit.
     */
    fun expandUpcE(code: String): String? {
        if (!UPC_E.matches(code)) return null
        val system = code[0]
        val body = code.substring(1, 7)
        val check = code[7]
        // The last of the 6 digits says where the zeros go.
        return when (val last = body[5]) {
            '0', '1', '2' -> "$system${body.substring(0, 2)}${last}0000${body.substring(2, 5)}$check"
            '3' -> "$system${body.substring(0, 3)}00000${body.substring(3, 5)}$check"
            '4' -> "$system${body.substring(0, 4)}00000${body[4]}$check"
            else -> "$system${body.substring(0, 5)}0000$last$check"
        }
    }

    /**
     * Returns the 13 digits of a code of 8, 12, or 13 digits, or null when the length or the check digit is wrong.
     * EAN-8 and UPC-E both have 8 digits, and the digits do not tell them apart.
     * So 8 digits are EAN-8, and only `upcE = true` makes them UPC-E.
     */
    fun normalize(code: String, upcE: Boolean = false): String? {
        if (!isDigits(code)) return null
        val full = if (upcE && code.length == 8) expandUpcE(code) else code
        if (full == null || full.length !in CODE_LENGTHS || !hasGs1CheckDigit(full)) return null
        return full.padStart(GTIN_13, '0')
    }

    /**
     * True for a 13-digit code that only one store or one company can know: it starts with 2, 02, or 04.
     * 02 and 04 are the UPC-A number systems 2 and 4. An open product database cannot resolve such a code.
     */
    fun isStoreInternal(gtin13: String): Boolean = gtin13.startsWith("2") || gtin13.startsWith("02") || gtin13.startsWith("04")

    /**
     * Returns each code of 8, 12, or 13 digits with a right check digit in an OCR text, as the text has it.
     * A package prints the digits in groups, for example "8 076809 513753", so the groups of one line join.
     * A word between two groups stops the join, and a line break stops it too. The marks < and > at a group do not count.
     * It reads 8 digits as EAN-8 and never as UPC-E. It corrects no character: a guessed digit can give a wrong product.
     */
    fun digitRuns(text: String): List<String> = text.lines().flatMap(::codesOfLine).distinct()

    /** The same for text elements that are neighbours on one line, in reading order. */
    fun digitRuns(elements: List<String>): List<String> = digitRuns(elements.joinToString(" ") { it.replace('\n', ' ') })

    private fun codesOfLine(line: String): List<String> {
        val codes = mutableListOf<String>()
        val groups = mutableListOf<String>()
        for (word in line.trim().split(SPACES)) {
            val group = word.trim('<', '>')
            if (isDigits(group)) {
                groups += group
            } else {
                codes += codesOfGroups(groups)
                groups.clear()
            }
        }
        return codes + codesOfGroups(groups)
    }

    // The longest code wins, and no group counts for two codes.
    private fun codesOfGroups(groups: List<String>): List<String> {
        val spans = mutableListOf<Span>()
        for (from in groups.indices) {
            var joined = ""
            for (to in from until groups.size) {
                joined += groups[to]
                if (joined.length > GTIN_13) break
                if (joined.length in CODE_LENGTHS && hasGs1CheckDigit(joined)) spans += Span(from, to, joined)
            }
        }
        val kept = mutableListOf<Span>()
        for (span in spans.sortedByDescending { it.code.length }) {
            if (kept.none { span.from <= it.to && it.from <= span.to }) kept += span
        }
        return kept.sortedBy { it.from }.map { it.code }
    }
}
