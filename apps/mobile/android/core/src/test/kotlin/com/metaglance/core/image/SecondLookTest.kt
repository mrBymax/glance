package com.metaglance.core.image

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SecondLookTest {
    // A still stalls the motion samples for seconds, and the server waits for this still only with SECOND_LOOK_WAIT_MS.
    @Test fun `the second look still is off by default, in the app and in its build`() {
        assertFalse(SecondLook.DEFAULT_ON)
        val build = File("../app/build.gradle.kts").readText()
        assertTrue(build.contains("localBool(\"glance.secondLookStill\", ${SecondLook.DEFAULT_ON})"))
    }

    @Test fun `the log line and the menu item name the state`() {
        assertEquals("second look still: off", SecondLook.logLine(false))
        assertEquals("second look still: on", SecondLook.logLine(true))
        assertEquals("Second look still: off", SecondLook.menuLabel(false))
        assertEquals("Second look still: on", SecondLook.menuLabel(true))
    }
}
