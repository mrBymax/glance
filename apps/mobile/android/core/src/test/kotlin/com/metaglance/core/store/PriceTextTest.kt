package com.metaglance.core.store

import org.junit.Assert.assertEquals
import org.junit.Test

class PriceTextTest {
    private fun cents(text: String): Int? = (PriceText.parse(text) as? Price.Cents)?.value

    @Test fun `reads euros with a point or a comma`() {
        assertEquals(249, cents("2.49"))
        assertEquals(249, cents("2,49"))
        assertEquals(200, cents("2"))
        assertEquals(250, cents("2.5"))
        assertEquals(250, cents("2,50"))
        assertEquals(99, cents("0.99"))
        assertEquals(99, cents(",99"))
        assertEquals(5, cents("0.05"))
        assertEquals(1000, cents("10."))
        assertEquals(249, cents("  2.49 "))
        assertEquals(249, cents("02.49"))
    }

    // 0.29 * 100 is 28.999999999999996 as a double, and 19.99 * 100 is 1998.9999999999998.
    @Test fun `makes no error of a floating point number`() {
        assertEquals(29, cents("0.29"))
        assertEquals(1999, cents("19.99"))
        assertEquals(1, cents("0.01"))
        assertEquals(107, cents("1.07"))
        assertEquals(999_999, cents("9999.99"))
        for (value in 1..9999) {
            val text = "${value / 100}.${(value % 100).toString().padStart(2, '0')}"
            assertEquals(text, value, cents(text))
        }
    }

    @Test fun `an empty field is empty, and a price of zero is zero`() {
        assertEquals(Price.Empty, PriceText.parse(""))
        assertEquals(Price.Empty, PriceText.parse("   "))
        assertEquals(Price.Zero, PriceText.parse("0"))
        assertEquals(Price.Zero, PriceText.parse("0,00"))
    }

    @Test fun `a price above the limit of the server is too high`() {
        assertEquals(Price.TooHigh, PriceText.parse("10000"))
        assertEquals(Price.TooHigh, PriceText.parse("10000.00"))
        assertEquals(Price.TooHigh, PriceText.parse("123456789012345678901234567890"))
    }

    @Test fun `each other text is no price`() {
        for (text in listOf("abc", "2.499", "2..49", "2.4.9", "-2", "+2", "2 49", "1e3", "1,000.00", "2€", ".", ",", "٢")) {
            assertEquals(text, Price.NotAPrice, PriceText.parse(text))
        }
    }

    @Test fun `writes cents as euros with a point`() {
        assertEquals("2.49", PriceText.format(249))
        assertEquals("0.05", PriceText.format(5))
        assertEquals("10.00", PriceText.format(1000))
        assertEquals("9999.99", PriceText.format(999_999))
        assertEquals(249, cents(PriceText.format(249)))
    }
}
