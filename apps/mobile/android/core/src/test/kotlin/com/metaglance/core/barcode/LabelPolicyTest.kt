package com.metaglance.core.barcode

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LabelPolicyTest {
    /** Feeds the frames of `range`, and returns the times at which the policy asks for a still. */
    private fun LabelPolicy.stills(range: IntProgression, region: Boolean = true, accepted: (Int) -> Boolean = { false }): List<Int> = range.filter { onFrame(it.toLong(), region, accepted(it)) }

    @Test fun `asks for one still after a region was in view for 2500 ms`() {
        assertEquals(listOf(2500), LabelPolicy().stills(0..5000 step 100))
    }

    @Test fun `asks for the next still 6 seconds after the last one`() {
        assertEquals(listOf(2500, 8500), LabelPolicy().stills(0..12000 step 100))
    }

    @Test fun `asks for no still with no region`() {
        assertEquals(emptyList<Int>(), LabelPolicy().stills(0..9000 step 100, region = false))
    }

    @Test fun `an accepted code starts the time of the region again`() {
        assertEquals(listOf(4600), LabelPolicy().stills(0..6000 step 100) { it == 2000 })
    }

    @Test fun `asks for no still while a code is accepted`() {
        assertEquals(emptyList<Int>(), LabelPolicy().stills(0..9000 step 100) { true })
    }

    @Test fun `keeps the time of the region over a gap of 600 ms`() {
        val policy = LabelPolicy()
        policy.stills(0..1000 step 100)
        policy.stills(1100..1500 step 100, region = false)
        assertEquals(listOf(2500), policy.stills(1600..3000 step 100))
    }

    @Test fun `a longer gap starts the time of the region again`() {
        val policy = LabelPolicy()
        policy.stills(0..1000 step 100)
        policy.stills(1100..1600 step 100, region = false)
        assertEquals(listOf(4200), policy.stills(1700..5000 step 100))
    }

    @Test fun `a request of the server gives a still at once, with no region`() {
        assertTrue(LabelPolicy().onFrame(0, regionInView = false, codeAccepted = false, requested = true))
    }

    @Test fun `a request and the region share the limit of one still each 6 seconds`() {
        val policy = LabelPolicy()
        assertEquals(listOf(2500), policy.stills(0..3000 step 100))
        assertFalse(policy.onFrame(3100, regionInView = true, codeAccepted = false, requested = true))
        assertFalse(policy.onFrame(8400, regionInView = false, codeAccepted = false, requested = true))
        assertTrue(policy.onFrame(8500, regionInView = false, codeAccepted = false, requested = true))
        assertEquals(emptyList<Int>(), policy.stills(8600..14400 step 100))
        assertEquals(listOf(14500), policy.stills(14500..15000 step 100))
    }

    @Test fun `a request while a code is accepted gives no still`() {
        assertFalse(LabelPolicy().onFrame(0, regionInView = true, codeAccepted = true, requested = true))
    }
}
