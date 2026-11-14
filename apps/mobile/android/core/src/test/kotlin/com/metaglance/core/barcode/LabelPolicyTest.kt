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

    @Test fun `a region that waited behind a prompt needs its time again after the prompt, and the wait uses no still gap and no still of the region`() {
        val dropped = ArrayList<LabelDrop>()
        val policy = LabelPolicy(dwellMs = 2500, onDropped = dropped::add)
        val held = (0..4000 step 100).filter { policy.onFrame(it.toLong(), regionInView = true, codeAccepted = false, hold = true) }
        assertEquals(emptyList<Int>(), held)
        assertEquals(emptyList<LabelDrop>(), dropped)
        // The prompt got its answer at 4100. The still does not start right after it: the region asks again after its time.
        assertEquals(listOf(6600, 12_600, 18_600), (4100..40_000 step 100).filter { policy.onFrame(it.toLong(), regionInView = true, codeAccepted = false) })
        assertEquals(listOf(LabelDrop.REGION), dropped)
    }

    @Test fun `a region that waits behind a prompt for 3 seconds starts its time again`() {
        val dropped = ArrayList<LabelDrop>()
        val policy = LabelPolicy(dwellMs = 1000, onDropped = dropped::add)
        // The region asks at 1000, 5000, and 9000, and each request is stale 3 seconds later.
        (0..12_500 step 100).forEach { assertFalse(policy.onFrame(it.toLong(), regionInView = true, codeAccepted = false, hold = true)) }
        assertEquals(listOf(LabelDrop.REGION, LabelDrop.REGION, LabelDrop.REGION), dropped)
    }

    @Test fun `a request that meets a prompt gives no still when the prompt gets its answer`() {
        val dropped = ArrayList<LabelDrop>()
        val policy = LabelPolicy(onDropped = dropped::add)
        assertFalse(policy.onFrame(0, regionInView = false, codeAccepted = false, requested = true, hold = true))
        (100..2000 step 100).forEach { assertFalse(policy.onFrame(it.toLong(), regionInView = false, codeAccepted = false, hold = true)) }
        assertEquals(emptyList<LabelDrop>(), dropped)
        // The head answer came at 2050. The product has its name, so the still has no use.
        (2100..9000 step 100).forEach { assertFalse(policy.onFrame(it.toLong(), regionInView = false, codeAccepted = false)) }
        assertEquals(listOf(LabelDrop.REQUEST), dropped)
    }

    @Test fun `a request that waits behind a prompt is dropped 3 seconds after it arrived`() {
        val dropped = ArrayList<LabelDrop>()
        val policy = LabelPolicy(onDropped = dropped::add)
        (0..2900 step 100).forEach { assertFalse(policy.onFrame(it.toLong(), regionInView = false, codeAccepted = false, requested = it == 0, hold = true)) }
        assertEquals(emptyList<LabelDrop>(), dropped)
        assertFalse(policy.onFrame(3000, regionInView = false, codeAccepted = false, hold = true))
        assertEquals(listOf(LabelDrop.REQUEST), dropped)
        (3100..9000 step 100).forEach { assertFalse(policy.onFrame(it.toLong(), regionInView = false, codeAccepted = false, hold = it < 6000)) }
        assertEquals(1, dropped.size)
    }

    @Test fun `a request that is 3 seconds old when a frame arrives is dropped, also with no prompt`() {
        val dropped = ArrayList<LabelDrop>()
        val policy = LabelPolicy(onDropped = dropped::add)
        // A still stopped the frames for 3 seconds after the request arrived.
        assertFalse(policy.onFrame(3000, regionInView = false, codeAccepted = false, requested = true, requestMs = 0))
        assertEquals(listOf(LabelDrop.REQUEST), dropped)
        assertTrue(policy.onFrame(3100, regionInView = false, codeAccepted = false, requested = true, requestMs = 200))
    }

    // Phone times of the log, from 22:34:34.180: still.request at 0, the first frame after a still at 2783,
    // the prompts p-0003 and p-0004 from 750 to the head answer at 7165, and the next frame at 7212.
    @Test fun `the session of 2026-11-14, a request that waited 7 seconds behind two prompts gives no still`() {
        val dropped = ArrayList<LabelDrop>()
        val policy = LabelPolicy(onDropped = dropped::add)
        assertFalse(policy.onFrame(2783, regionInView = false, codeAccepted = false, requested = true, hold = true, requestMs = 0))
        assertEquals(emptyList<LabelDrop>(), dropped)
        (2850..7150 step 150).forEach { assertFalse(policy.onFrame(it.toLong(), regionInView = false, codeAccepted = false, hold = true)) }
        assertEquals(listOf(LabelDrop.REQUEST), dropped)
        // The old code took the still here, 47 ms after the nod that added the product.
        (7212..15_000 step 150).forEach { assertFalse(policy.onFrame(it.toLong(), regionInView = false, codeAccepted = false)) }
        assertEquals(1, dropped.size)
    }

    @Test fun `a new request while one waits behind a prompt takes its place`() {
        val dropped = ArrayList<LabelDrop>()
        val policy = LabelPolicy(onDropped = dropped::add)
        assertFalse(policy.onFrame(0, regionInView = false, codeAccepted = false, requested = true, hold = true))
        assertFalse(policy.onFrame(2000, regionInView = false, codeAccepted = false, requested = true, hold = true))
        assertFalse(policy.onFrame(4900, regionInView = false, codeAccepted = false, hold = true))
        assertEquals(emptyList<LabelDrop>(), dropped)
        assertFalse(policy.onFrame(5000, regionInView = false, codeAccepted = false, hold = true))
        assertEquals(listOf(LabelDrop.REQUEST), dropped)
    }
}
