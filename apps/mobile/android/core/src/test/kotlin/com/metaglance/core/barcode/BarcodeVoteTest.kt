package com.metaglance.core.barcode

import com.metaglance.core.contract.BarcodeSource
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BarcodeVoteTest {
    private val pasta = "8076809513753"
    private val pens = "4006381333931"
    private val decoded = CodeRead(pasta, BarcodeSource.BARCODE)
    private val digits = CodeRead(pasta, BarcodeSource.OCR)

    @Test fun `reports a decoder code at its second read and not at its first`() {
        val vote = BarcodeVote()
        assertNull(vote.onFrame(0, decoded))
        assertFalse(vote.accepted)
        assertEquals(decoded, vote.onFrame(140, decoded))
        assertTrue(vote.accepted)
    }

    @Test fun `two decoder reads count inside 1500 ms only`() {
        val vote = BarcodeVote()
        assertNull(vote.onFrame(0, decoded))
        assertNull(vote.onFrame(1501, decoded))
        assertEquals(decoded, vote.onFrame(3001, decoded))
    }

    @Test fun `reports an OCR code at its third read`() {
        val vote = BarcodeVote()
        assertNull(vote.onFrame(0, digits))
        assertNull(vote.onFrame(400, digits))
        assertEquals(digits, vote.onFrame(800, digits))
    }

    @Test fun `three OCR reads count inside 2500 ms only`() {
        val vote = BarcodeVote()
        assertNull(vote.onFrame(0, digits))
        assertNull(vote.onFrame(1300, digits))
        assertNull(vote.onFrame(2600, digits))
        assertEquals(digits, vote.onFrame(3800, digits))
    }

    @Test fun `one decoder read and two OCR reads count as three OCR reads`() {
        val vote = BarcodeVote()
        assertNull(vote.onFrame(0, digits))
        assertNull(vote.onFrame(400, decoded))
        assertEquals(digits, vote.onFrame(800, digits))
    }

    @Test fun `a different valid code resets the count`() {
        val vote = BarcodeVote()
        assertNull(vote.onFrame(0, decoded))
        assertNull(vote.onFrame(140, CodeRead(pens, BarcodeSource.BARCODE)))
        assertNull(vote.onFrame(280, decoded))
        assertEquals(decoded, vote.onFrame(420, decoded))
    }

    @Test fun `a frame with no code does not reset the count`() {
        val vote = BarcodeVote()
        assertNull(vote.onFrame(0, decoded))
        assertNull(vote.onFrame(140, null))
        assertEquals(decoded, vote.onFrame(280, decoded))
    }

    @Test fun `repeats the code one time each second while it stays in view`() {
        val vote = BarcodeVote()
        val reports = (0..3000 step 100).filter { vote.onFrame(it.toLong(), decoded) != null }
        assertEquals(listOf(100, 1100, 2100), reports)
    }

    @Test fun `keeps the appearance over a gap of 1000 ms`() {
        val vote = BarcodeVote()
        vote.onFrame(0, decoded)
        vote.onFrame(100, decoded)
        (200..1000 step 100).forEach { assertNull(vote.onFrame(it.toLong(), null)) }
        assertTrue(vote.accepted)
        assertEquals(decoded, vote.onFrame(1100, decoded))
    }

    @Test fun `a longer gap ends the appearance, and the code needs its reads again`() {
        val vote = BarcodeVote()
        vote.onFrame(0, decoded)
        vote.onFrame(100, decoded)
        assertNull(vote.onFrame(1200, null))
        assertFalse(vote.accepted)
        assertNull(vote.onFrame(1300, decoded))
        assertEquals(decoded, vote.onFrame(1400, decoded))
    }

    @Test fun `another code after a report starts its own count`() {
        val vote = BarcodeVote()
        val other = CodeRead(pens, BarcodeSource.BARCODE)
        vote.onFrame(0, decoded)
        vote.onFrame(100, decoded)
        assertNull(vote.onFrame(200, other))
        assertFalse(vote.accepted)
        assertEquals(other, vote.onFrame(300, other))
    }

    @Test fun `an accepted OCR code keeps its source when the decoder reads it later`() {
        val vote = BarcodeVote()
        vote.onFrame(0, digits)
        vote.onFrame(400, digits)
        vote.onFrame(800, digits)
        assertEquals(digits, vote.onFrame(1800, decoded))
    }
}
