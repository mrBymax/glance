package com.metaglance.core.barcode

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LabelPolicyTest {
    /** Feeds the frames of `range`, and returns the times at which the policy asks for a still. */
    private fun LabelPolicy.stills(range: IntProgression, region: Boolean = true, accepted: (Int) -> Boolean = { false }): List<Int> = range.filter { onFrame(it.toLong(), region, accepted(it)) }

    // The still and the label call take about 5 seconds, so the wait before them is short.
    @Test fun `the default wait is 1000 ms, and the default gap is 6000 ms`() {
        assertEquals(listOf(1000, 7000), LabelPolicy().stills(0..12000 step 100))
    }

    @Test fun `asks for one still after a region was in view for 2500 ms`() {
        assertEquals(listOf(2500), LabelPolicy(dwellMs = 2500).stills(0..5000 step 100))
    }

    @Test fun `asks for the next still 6 seconds after the last one`() {
        assertEquals(listOf(2500, 8500), LabelPolicy(dwellMs = 2500).stills(0..12000 step 100))
    }

    @Test fun `asks for no still with no region`() {
        assertEquals(emptyList<Int>(), LabelPolicy(dwellMs = 2500).stills(0..9000 step 100, region = false))
    }

    @Test fun `an accepted code starts the time of the region again`() {
        assertEquals(listOf(4600), LabelPolicy(dwellMs = 2500).stills(0..6000 step 100) { it == 2000 })
    }

    @Test fun `asks for no still while a code is accepted`() {
        assertEquals(emptyList<Int>(), LabelPolicy(dwellMs = 2500).stills(0..9000 step 100) { true })
    }

    @Test fun `keeps the time of the region over a gap of 600 ms`() {
        val policy = LabelPolicy(dwellMs = 2500)
        policy.stills(0..1000 step 100)
        policy.stills(1100..1500 step 100, region = false)
        assertEquals(listOf(2500), policy.stills(1600..3000 step 100))
    }

    @Test fun `a longer gap starts the time of the region again`() {
        val policy = LabelPolicy(dwellMs = 2500)
        policy.stills(0..1000 step 100)
        policy.stills(1100..1600 step 100, region = false)
        assertEquals(listOf(4200), policy.stills(1700..5000 step 100))
    }

    @Test fun `a request of the server gives a still at once, with no region`() {
        assertTrue(LabelPolicy(dwellMs = 2500).onFrame(0, regionInView = false, codeAccepted = false, requested = true))
    }

    @Test fun `a request and the region share the limit of one still each 6 seconds`() {
        val policy = LabelPolicy(dwellMs = 2500)
        assertEquals(listOf(2500), policy.stills(0..3000 step 100))
        assertFalse(policy.onFrame(3100, regionInView = true, codeAccepted = false, requested = true))
        assertFalse(policy.onFrame(8400, regionInView = false, codeAccepted = false, requested = true))
        assertTrue(policy.onFrame(8500, regionInView = false, codeAccepted = false, requested = true))
        assertEquals(emptyList<Int>(), policy.stills(8600..14400 step 100))
        assertEquals(listOf(14500), policy.stills(14500..15000 step 100))
    }

    @Test fun `a request while a code is accepted gives no still`() {
        assertFalse(LabelPolicy(dwellMs = 2500).onFrame(0, regionInView = true, codeAccepted = true, requested = true))
    }

    @Test fun `a region asks for no other still after a still gave its code, while it stays in view`() {
        val policy = LabelPolicy(dwellMs = 2500)
        assertEquals(listOf(2500), policy.stills(0..3000 step 100))
        policy.onStillCode()
        assertEquals(emptyList<Int>(), policy.stills(3100..20000 step 100))
    }

    @Test fun `a region that comes back after a still with a code asks for a still again`() {
        val policy = LabelPolicy(dwellMs = 2500)
        assertEquals(listOf(2500), policy.stills(0..3000 step 100))
        policy.onStillCode()
        policy.stills(3100..6000 step 100)
        policy.stills(6100..6700 step 100, region = false)
        assertEquals(listOf(9300), policy.stills(6800..12000 step 100))
    }

    @Test fun `a request of the server gives a still also after a still gave a code`() {
        val policy = LabelPolicy(dwellMs = 2500)
        assertEquals(listOf(2500), policy.stills(0..3000 step 100))
        policy.onStillCode()
        assertEquals(emptyList<Int>(), policy.stills(3100..8400 step 100))
        assertTrue(policy.onFrame(8500, regionInView = true, codeAccepted = false, requested = true))
    }

    @Test fun `a still with no code keeps the region rule`() {
        assertEquals(listOf(2500, 8500, 14500), LabelPolicy(dwellMs = 2500).stills(0..15000 step 100))
    }

    @Test fun `asks for no still while no upload can go out, and then at once`() {
        val policy = LabelPolicy(dwellMs = 2500)
        val stills = (0..4000 step 100).filter { policy.onFrame(it.toLong(), regionInView = true, codeAccepted = false, canUpload = it >= 3500) }
        assertEquals(listOf(3500), stills)
    }

    @Test fun `a request while no upload can go out is dropped`() {
        val policy = LabelPolicy(dwellMs = 2500)
        assertFalse(policy.onFrame(0, regionInView = false, codeAccepted = false, requested = true, canUpload = false))
        assertFalse(policy.onFrame(100, regionInView = false, codeAccepted = false))
        assertTrue(policy.onFrame(200, regionInView = false, codeAccepted = false, requested = true))
    }

    @Test fun `asks for the still in a frame that shows the region`() {
        val policy = LabelPolicy(dwellMs = 2500)
        policy.stills(0..2400 step 100)
        assertFalse(policy.onFrame(2500, regionInView = false, codeAccepted = false))
        assertTrue(policy.onFrame(2600, regionInView = true, codeAccepted = false))
    }

    @Test fun `the region needs its time again after a still`() {
        assertEquals(listOf(2500, 5100), LabelPolicy(dwellMs = 2500, everyMs = 1000).stills(0..6000 step 100))
    }

    @Test fun `a region that stays in view asks for 3 stills at most`() {
        assertEquals(listOf(2500, 8500, 14500), LabelPolicy(dwellMs = 2500).stills(0..60000 step 100))
    }

    @Test fun `a region that comes back after its 3 stills asks again`() {
        val policy = LabelPolicy(dwellMs = 2500)
        policy.stills(0..30000 step 100)
        policy.stills(30100..30700 step 100, region = false)
        assertEquals(listOf(33300), policy.stills(30800..36000 step 100))
    }

    @Test fun `a request of the server gives a still also after the 3 stills of a region`() {
        val policy = LabelPolicy(dwellMs = 2500)
        policy.stills(0..30000 step 100)
        assertTrue(policy.onFrame(30100, regionInView = true, codeAccepted = false, requested = true))
    }

    @Test fun `a still for a request is none of the 3 stills of a region`() {
        val policy = LabelPolicy(dwellMs = 2500)
        assertTrue(policy.onFrame(0, regionInView = true, codeAccepted = false, requested = true))
        assertEquals(listOf(6000, 12000, 18000), policy.stills(100..60000 step 100))
    }
}
