package com.metaglance.core.kiosk

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test

class KioskCodeTest {
    @Test fun `parses the texts of the Plan 0 test`() {
        assertEquals("K3X7", KioskCode.parse("GL1 K3X7"))
        assertEquals("K3X7", KioskCode.parse("  gl1   k3x7 \n"))
        for (bad in listOf("https://example.com/k/1", "GL2 K3X7", "GL1 TOOLONGCODE", "", "GL1", "GL1 K3X7 K3X7")) {
            assertNull(bad, KioskCode.parse(bad))
        }
        assertEquals("GL1 K3X7", KioskCode.format("K3X7"))
        assertThrows(IllegalArgumentException::class.java) { KioskCode.format("k3x7") }
    }
}
