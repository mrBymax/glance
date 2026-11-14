package com.metaglance.core.state

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class HapticPatternsTest {
    @Test fun `has a different pattern for each name, and each starts with a pause of 0`() {
        val all = HapticPattern.values().map { HapticPatterns.timings(it).toList() }
        assertEquals(8, all.toSet().size)
        for (t in all) {
            assertEquals(0L, t.first())
            assertEquals(0, t.size % 2)
            assertTrue(t.sum() <= 2500)
        }
    }

    @Test fun `has the timings of the plan`() {
        assertArrayEquals(longArrayOf(0, 40, 80, 40), HapticPatterns.timings(HapticPattern.ADDED))
        assertArrayEquals(longArrayOf(0, 400, 200, 400, 200, 400), HapticPatterns.timings(HapticPattern.CAMERA_OFF))
    }
}
