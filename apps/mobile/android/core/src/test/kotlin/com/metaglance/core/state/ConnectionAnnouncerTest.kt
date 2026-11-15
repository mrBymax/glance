package com.metaglance.core.state

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ConnectionAnnouncerTest {
    private val line = "Connection lost. Your cart is safe. Glances are paused."

    @Test fun `says the line one time after 3 seconds without the socket`() {
        val a = ConnectionAnnouncer()
        a.onSocketDown(1000)
        assertNull(a.onTick(3999))
        assertEquals(line, a.onTick(4000))
        assertNull(a.onTick(5000))
    }

    @Test fun `says nothing for a short drop`() {
        val a = ConnectionAnnouncer()
        a.onSocketDown(1000)
        a.onSocketOpen()
        assertNull(a.onTick(5000))
    }

    @Test fun `keeps the time of the first report while the socket stays down`() {
        val a = ConnectionAnnouncer()
        a.onSocketDown(1000)
        a.onSocketDown(3500)
        assertEquals(line, a.onTick(4000))
    }

    @Test fun `says the line again for the next drop`() {
        val a = ConnectionAnnouncer()
        a.onSocketDown(1000)
        a.onTick(4000)
        a.onSocketOpen()
        a.onSocketDown(10_000)
        assertNull(a.onTick(12_999))
        assertEquals(line, a.onTick(13_000))
    }
}
