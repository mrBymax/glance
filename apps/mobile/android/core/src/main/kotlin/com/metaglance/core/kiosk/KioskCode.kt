package com.metaglance.core.kiosk

/** The rules of `kioskCode.ts` in `packages/shared`. A kiosk code has 4 to 8 characters from A-Z and 0-9. */
object KioskCode {
    private const val PREFIX = "GL1"
    private val CODE = Regex("^[A-Z0-9]{4,8}$")
    private val SPACES = Regex("\\s+")

    /**
     * Returns the kiosk code of a QR text, or null when the text is not a kiosk code.
     * A QR decoder can return lowercase letters and extra spaces, so the text is normalized first.
     */
    fun parse(text: String): String? {
        val parts = text.trim().uppercase().split(SPACES)
        if (parts.size != 2 || parts[0] != PREFIX) return null
        return parts[1].takeIf { CODE.matches(it) }
    }

    /** Returns the QR text of a kiosk code, for example "GL1 K3X7". */
    fun format(code: String): String {
        require(CODE.matches(code)) { "A kiosk code has 4 to 8 characters from A-Z and 0-9." }
        return "$PREFIX $code"
    }
}
