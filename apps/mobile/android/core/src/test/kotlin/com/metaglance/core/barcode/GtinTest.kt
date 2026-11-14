package com.metaglance.core.barcode

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The test values of `gtin.test.ts` in `packages/shared`, and the texts of an OCR result. */
class GtinTest {
    @Test fun `accepts the check digit of published codes of each length`() {
        for (code in listOf("4006381333931", "3017624010701", "8076809513753", "036000291452", "73513537", "00012345600012")) {
            assertTrue(code, Gtin.hasGs1CheckDigit(code))
        }
    }

    @Test fun `rejects a wrong check digit, two swapped digits, and text that is not digits`() {
        for (code in listOf("4006381333932", "4006381333913", "8076809513758", "03600029145 2", "4006381E33931", "")) {
            assertFalse(code, Gtin.hasGs1CheckDigit(code))
        }
    }

    @Test fun `expands UPC-E to UPC-A for each last digit`() {
        assertEquals("012345000065", Gtin.expandUpcE("01234565"))
        assertEquals("042100005264", Gtin.expandUpcE("04252614"))
        assertEquals("012000000003", Gtin.expandUpcE("01200003"))
        assertEquals("012100003454", Gtin.expandUpcE("01234514"))
        assertEquals("012200003453", Gtin.expandUpcE("01234523"))
        assertEquals("012300000451", Gtin.expandUpcE("01234531"))
        assertEquals("012340000053", Gtin.expandUpcE("01234543"))
        assertEquals("112345000093", Gtin.expandUpcE("11234593"))
    }

    @Test fun `expands no text that is not UPC-E`() {
        for (code in listOf("1234565", "012345650", "21234565", "0123456A", "")) assertNull(code, Gtin.expandUpcE(code))
    }

    @Test fun `normalizes EAN-13, UPC-A, and EAN-8 to 13 digits`() {
        assertEquals("8076809513753", Gtin.normalize("8076809513753"))
        assertEquals("0036000291452", Gtin.normalize("036000291452"))
        assertEquals("0000073513537", Gtin.normalize("73513537"))
    }

    @Test fun `expands 8 digits as UPC-E only when the caller names the format`() {
        assertEquals("0012345000065", Gtin.normalize("01234565", upcE = true))
        assertEquals("0042100005264", Gtin.normalize("04252614", upcE = true))
        // 04252614 has the check digit of its UPC-A form. It is no valid EAN-8.
        assertNull(Gtin.normalize("04252614"))
        assertEquals("0036000291452", Gtin.normalize("036000291452", upcE = true))
    }

    @Test fun `gives null for a wrong check digit, another length, and text that is not digits`() {
        for (code in listOf("8076809513758", "036000291453", "73513538", "00012345600012", "12345", " 8076809513753", "807680951375E")) {
            assertNull(code, Gtin.normalize(code))
        }
        assertNull(Gtin.normalize("04252615", upcE = true))
        assertNull(Gtin.normalize("91234565", upcE = true))
    }

    @Test fun `knows the codes of one store`() {
        for (gtin in listOf("2000000000008", "2912345678906", "0412345678903", "0212345678909")) {
            assertTrue(gtin, Gtin.isStoreInternal(gtin))
        }
        for (gtin in listOf("8076809513753", "0036000291452", "0012345000065", "4006381333931", "0000073513537")) {
            assertFalse(gtin, Gtin.isStoreInternal(gtin))
        }
    }

    @Test fun `finds a code that the text has in one piece`() {
        assertEquals(listOf("8076809513753"), Gtin.digitRuns("8076809513753"))
        assertEquals(listOf("036000291452"), Gtin.digitRuns("  036000291452 "))
        assertEquals(listOf("73513537"), Gtin.digitRuns("73513537"))
    }

    @Test fun `joins the groups of digits of one line`() {
        assertEquals(listOf("8076809513753"), Gtin.digitRuns("8 076809 513753"))
        assertEquals(listOf("036000291452"), Gtin.digitRuns("0 36000 29145 2"))
        assertEquals(listOf("73513537"), Gtin.digitRuns("7351\t3537"))
        assertEquals(listOf("4006381333931"), Gtin.digitRuns("4 006381 333931 >"))
        assertEquals(listOf("4006381333931"), Gtin.digitRuns("<4 006381 333931>"))
    }

    @Test fun `finds the code between the other words of a label`() {
        assertEquals(listOf("8076809513753"), Gtin.digitRuns("Barilla 8 076809 513753 500 g"))
        assertEquals(listOf("3017624010701"), Gtin.digitRuns("Nutella\n3 017624 010701\n400 g"))
    }

    @Test fun `joins the digits of neighbouring text elements`() {
        assertEquals(listOf("8076809513753"), Gtin.digitRuns(listOf("8", "076809", "513753")))
        assertEquals(listOf("8076809513753"), Gtin.digitRuns(listOf("Barilla", "8 076809", "513753", "500g")))
        assertEquals(emptyList<String>(), Gtin.digitRuns(listOf("8", "076809", "N.", "513753")))
        assertEquals(emptyList<String>(), Gtin.digitRuns(emptyList()))
    }

    @Test fun `joins no digits over a line break in one text`() {
        assertEquals(emptyList<String>(), Gtin.digitRuns("8 076809\n513753"))
    }

    @Test fun `gives each code of a text one time, in the order of the text`() {
        assertEquals(
            listOf("4006381333931", "3017624010701"),
            Gtin.digitRuns("4006381333931\n3 017624 010701\n4 006381 333931")
        )
    }

    @Test fun `gives no code for a wrong check digit, a wrong length, or a digit that is a letter`() {
        for (text in listOf("8 076809 513758", "18076809513753", "8 O76809 513753", "807680951375", "12345", "")) {
            assertEquals(text, emptyList<String>(), Gtin.digitRuns(text))
        }
    }

    @Test fun `gives no part of a code that it found`() {
        assertEquals(listOf("0036000291452"), Gtin.digitRuns("0 036000 291452"))
    }

    @Test fun `gives the code of a decoder as the phone sends it`() {
        assertEquals("8076809513753", Gtin.fromDecoder("8076809513753", upcE = false))
        assertEquals("036000291452", Gtin.fromDecoder("036000291452", upcE = false))
        assertEquals("73513537", Gtin.fromDecoder("73513537", upcE = false))
        assertEquals("012345000065", Gtin.fromDecoder("01234565", upcE = true))
    }

    @Test fun `gives no code for a decoder text with a wrong check digit or a wrong form`() {
        assertNull(Gtin.fromDecoder("8076809513758", upcE = false))
        assertNull(Gtin.fromDecoder("01234566", upcE = true))
        assertNull(Gtin.fromDecoder("1234565", upcE = true))
        assertNull(Gtin.fromDecoder("GL1 K3X7", upcE = false))
        assertNull(Gtin.fromDecoder("00012345600012", upcE = false))
    }
}
