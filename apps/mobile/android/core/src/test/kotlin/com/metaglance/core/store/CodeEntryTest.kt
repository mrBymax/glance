package com.metaglance.core.store

import org.junit.Assert.assertEquals
import org.junit.Test

class CodeEntryTest {
    private fun wrong(entry: CodeEntry): String = (entry as CodeEntry.Wrong).message

    @Test fun `typed digits of 8, 12, or 13 become 13 digits`() {
        assertEquals(CodeEntry.Code("8076800195057"), CodeEntry.typed("8076800195057"))
        assertEquals(CodeEntry.Code("0000080177173"), CodeEntry.typed("80177173"))
        assertEquals(CodeEntry.Code("0036000291452"), CodeEntry.typed("036000291452"))
    }

    @Test fun `spaces between the groups of typed digits do not count`() {
        assertEquals(CodeEntry.Code("8076800195057"), CodeEntry.typed(" 8 076800 195057 "))
    }

    @Test fun `a code of one store is a code`() {
        assertEquals(CodeEntry.Code("2000000000015"), CodeEntry.typed("2000000000015"))
    }

    @Test fun `says what is wrong with typed text`() {
        assertEquals("Type the digits under the barcode.", wrong(CodeEntry.typed("  ")))
        assertEquals("A barcode has digits only.", wrong(CodeEntry.typed("80768O0195057")))
        assertEquals("A barcode has 8, 12, or 13 digits. This one has 11.", wrong(CodeEntry.typed("80768001950")))
        assertEquals("A barcode has 8, 12, or 13 digits. This one has 14.", wrong(CodeEntry.typed("10036000291452")))
        assertEquals("The check digit is wrong. Read the digits again.", wrong(CodeEntry.typed("8076800195058")))
    }

    @Test fun `a scanned code becomes 13 digits, and a UPC-E code gets its long form`() {
        assertEquals(CodeEntry.Code("8076800195057"), CodeEntry.scanned("8076800195057", upcE = false))
        assertEquals(CodeEntry.Code("0000080177173"), CodeEntry.scanned("80177173", upcE = false))
        // 01234565 is the UPC-E form of 012345000065.
        assertEquals(CodeEntry.Code("0012345000065"), CodeEntry.scanned("01234565", upcE = true))
    }

    @Test fun `a scan with no product code says to scan again`() {
        val message = "The scanner read no product code. Scan again, or type the digits."
        assertEquals(message, wrong(CodeEntry.scanned(null, upcE = false)))
        assertEquals(message, wrong(CodeEntry.scanned("https://example.com", upcE = false)))
        assertEquals(message, wrong(CodeEntry.scanned("8076800195058", upcE = false)))
    }
}
