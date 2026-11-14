package com.metaglance.core.state

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class StopCausesTest {
    private fun facts(
        byApp: Boolean = false,
        session: Set<String> = emptySet(),
        stream: Set<String> = emptySet(),
        link: DatLinkState? = DatLinkState.CONNECTED,
        hinge: DatHinge? = DatHinge.OPEN
    ) = StopFacts(byApp, session, stream, link, hinge)

    @Test fun `names the cause of a stop from errors, link, and hinge`() {
        assertEquals(StopCause.APP, StopCauses.classify(facts(byApp = true, session = setOf("DEVICE_DISCONNECTED"))))
        assertEquals(StopCause.UPDATE_REQUIRED, StopCauses.classify(facts(session = setOf("DAT_APP_ON_THE_GLASSES_UPDATE_REQUIRED"))))
        for (e in listOf("THERMAL_CRITICAL", "THERMAL_EMERGENCY")) assertEquals(StopCause.TOO_WARM, StopCauses.classify(facts(session = setOf(e))))
        assertEquals(StopCause.TOO_WARM, StopCauses.classify(facts(stream = setOf("THERMAL_HOT"))))
        for (e in listOf("BATTERY_CRITICAL", "PEAK_POWER_SHUTDOWN")) assertEquals(StopCause.BATTERY, StopCauses.classify(facts(session = setOf(e))))
        for (e in listOf("BATTERY_LOW", "PEAK_POWER_LIMIT")) assertEquals(StopCause.BATTERY, StopCauses.classify(facts(stream = setOf(e))))
        assertEquals(StopCause.HINGE_CLOSED, StopCauses.classify(facts(stream = setOf("HINGE_CLOSED"))))
        assertEquals(
            StopCause.HINGE_CLOSED,
            StopCauses.classify(facts(session = setOf("DEVICE_DISCONNECTED"), link = DatLinkState.DISCONNECTED, hinge = DatHinge.CLOSED))
        )
        assertEquals(StopCause.LINK_LOST, StopCauses.classify(facts(session = setOf("DEVICE_DISCONNECTED"))))
        assertEquals(StopCause.LINK_LOST, StopCauses.classify(facts(link = DatLinkState.DISCONNECTED)))
        assertEquals(StopCause.DEVICE, StopCauses.classify(facts(session = setOf("SESSION_ENDED_BY_DEVICE"))))
        assertEquals(StopCause.OTHER, StopCauses.classify(facts()))
    }

    @Test fun `reads a stop with no device as a lost link`() {
        assertEquals(StopCause.LINK_LOST, StopCauses.classify(facts(link = null, hinge = null)))
    }

    @Test fun `starts a new session by itself only after a lost link or a closed hinge`() {
        assertEquals(setOf(StopCause.LINK_LOST, StopCause.HINGE_CLOSED), StopCause.values().filter { StopCauses.autoRestart(it) }.toSet())
    }

    @Test fun `waits for glasses that are connected, open, and not off the face`() {
        val d = DatDevice("g", DatLinkState.CONNECTED, DatCompatibility.COMPATIBLE, 80, DatDon.DONNED, DatHinge.OPEN, DatThermal.NONE)
        assertTrue(StopCauses.canStartNow(d))
        assertTrue(StopCauses.canStartNow(d.copy(don = DatDon.UNKNOWN)))
        assertFalse(StopCauses.canStartNow(d.copy(don = DatDon.DOFFED)))
        assertFalse(StopCauses.canStartNow(d.copy(hinge = DatHinge.CLOSED)))
        assertFalse(StopCauses.canStartNow(d.copy(link = DatLinkState.DISCONNECTED)))
        assertFalse(StopCauses.canStartNow(null))
    }
}
