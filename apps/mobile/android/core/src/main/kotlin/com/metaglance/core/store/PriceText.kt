package com.metaglance.core.store

/** What the price field of the product form holds. */
sealed interface Price {
    data class Cents(val value: Int) : Price

    data object Empty : Price

    data object NotAPrice : Price

    data object Zero : Price

    /** Above [PriceText.MAX_CENTS]. */
    data object TooHigh : Price
}

/** A price in euros as a person types it, and as the form shows it. */
object PriceText {
    /** The highest price that the server takes: 9999.99 EUR. */
    const val MAX_CENTS = 999_999
    private const val CENTS_IN_EURO = 100
    private val EUROS = Regex("^([0-9]*)(?:[.,]([0-9]{0,2}))?$")

    /**
     * Reads euros with at most two decimal digits, and a point or a comma between: "2.49", "2,5", "2", ",99".
     * It works on the digits of the text, so no floating point number rounds a cent away.
     */
    fun parse(text: String): Price {
        val clean = text.trim()
        if (clean.isEmpty()) return Price.Empty
        val match = EUROS.matchEntire(clean) ?: return Price.NotAPrice
        val whole = match.groupValues[1]
        val decimals = match.groupValues[2]
        if (whole.isEmpty() && decimals.isEmpty()) return Price.NotAPrice
        // A number with too many digits for a Long is above each limit.
        val euros = if (whole.isEmpty()) 0L else whole.toLongOrNull() ?: return Price.TooHigh
        val cents = euros * CENTS_IN_EURO + decimals.padEnd(2, '0').toInt()
        return when {
            euros > MAX_CENTS / CENTS_IN_EURO || cents > MAX_CENTS -> Price.TooHigh
            cents == 0L -> Price.Zero
            else -> Price.Cents(cents.toInt())
        }
    }

    /** "2.49" for 249. [parse] reads it back. */
    fun format(cents: Int): String = "${cents / CENTS_IN_EURO}.${(cents % CENTS_IN_EURO).toString().padStart(2, '0')}"
}
