package com.metaglance.core.state

import com.metaglance.core.contract.CameraPermission
import com.metaglance.core.contract.Capabilities
import com.metaglance.core.contract.DeviceState
import com.metaglance.core.contract.Link
import com.metaglance.core.contract.NativeDevice
import com.metaglance.core.contract.NativeState
import com.metaglance.core.contract.Network
import com.metaglance.core.contract.Registration
import com.metaglance.core.contract.SessionStatus
import com.metaglance.core.contract.StreamStatus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class StateMapperTest {
    private val device = DatDevice("Ray-Ban Meta", DatLinkState.CONNECTED, DatCompatibility.COMPATIBLE, 80, DatDon.DONNED, DatHinge.OPEN, DatThermal.NONE)
    private val live = DatSnapshot(
        bluetoothGranted = true,
        metaAiInstalled = true,
        registration = DatRegistration.REGISTERED,
        cameraPermission = DatPermission.GRANTED,
        microphonePermission = DatPermission.UNKNOWN,
        device = device,
        session = DatSession.STARTED,
        stream = DatStream.STREAMING,
        motionStarted = true,
        inputsActive = false,
        speechStarted = false,
        glassesAppUpdateRequired = false,
        mock = false
    )

    private fun native(dat: DatSnapshot, phoneOnline: Boolean = true, expected: Boolean = true, open: Boolean = true) = StateMapper.nativeState(dat, phoneOnline, expected, open)

    @Test fun `maps a live session`() {
        val n = native(live)
        assertEquals(
            NativeState(
                true,
                Registration.REGISTERED,
                CameraPermission.GRANTED,
                NativeDevice("Ray-Ban Meta", Link.CONNECTED, 80, true, true, 0, false),
                SessionStatus.STARTED,
                StreamStatus.STREAMING,
                Network.ONLINE,
                Capabilities(true, false, false),
                false
            ),
            n
        )
        assertEquals(DeviceState(Link.CONNECTED, 80, true, true, 0, StreamStatus.STREAMING), StateMapper.deviceState(live))
    }

    @Test fun `maps readings that the glasses did not report to null`() {
        val unknown = device.copy(name = "", battery = 0, don = DatDon.UNKNOWN, hinge = DatHinge.UNKNOWN, thermal = DatThermal.UNKNOWN)
        val d = native(live.copy(device = unknown)).device!!
        assertEquals(NativeDevice(null, Link.CONNECTED, null, null, null, null, false), d)
    }

    @Test fun `maps the thermal levels so that CRITICAL is 6`() {
        val levels = DatThermal.values().drop(1).map { StateMapper.deviceState(live.copy(device = device.copy(thermal = it))).thermal }
        assertEquals(listOf(0, 1, 3, 5, 6, 7, 7), levels)
    }

    @Test fun `maps each session state and each stream state`() {
        assertEquals(
            listOf("idle", "starting", "starting", "started", "paused", "stopped", "stopped"),
            DatSession.values().map { native(live.copy(session = it)).session.name.lowercase() }
        )
        assertEquals(
            listOf("stopped", "starting", "starting", "streaming", "paused", "stopped", "stopped", "stopped"),
            DatStream.values().map { native(live.copy(stream = it)).stream.name.lowercase() }
        )
    }

    @Test fun `maps a link that is not ready and a missing device`() {
        assertEquals(Link.DISCONNECTED, native(live.copy(device = device.copy(link = DatLinkState.CONNECTING))).device!!.link)
        assertNull(native(live.copy(device = null)).device)
        assertEquals(DeviceState(Link.DISCONNECTED, null, null, null, null, StreamStatus.STREAMING), StateMapper.deviceState(live.copy(device = null)))
    }

    @Test fun `maps UNREGISTERING and a denied Bluetooth permission`() {
        assertEquals(Registration.REGISTERING, native(live.copy(registration = DatRegistration.UNREGISTERING)).registration)
        assertEquals(Registration.UNAVAILABLE, native(live.copy(bluetoothGranted = false)).registration)
    }

    @Test fun `sets updateRequired for the glasses only`() {
        fun update(c: DatCompatibility, app: Boolean = false) = native(live.copy(device = device.copy(compatibility = c), glassesAppUpdateRequired = app)).device!!.updateRequired
        assertTrue(update(DatCompatibility.DEVICE_UPDATE_REQUIRED))
        assertTrue(update(DatCompatibility.COMPATIBLE, app = true))
        assertFalse(update(DatCompatibility.SDK_UPDATE_REQUIRED))
    }

    @Test fun `is offline when the phone is offline or when an expected socket is down`() {
        assertEquals(Network.OFFLINE, native(live, phoneOnline = false).network)
        assertEquals(Network.OFFLINE, native(live, expected = true, open = false).network)
        assertEquals(Network.ONLINE, native(live, expected = false, open = false).network)
    }
}
