package com.metaglance.core.state

import com.metaglance.core.contract.CameraPermission
import com.metaglance.core.contract.Capabilities
import com.metaglance.core.contract.DeviceState
import com.metaglance.core.contract.Link
import com.metaglance.core.contract.NativeDevice
import com.metaglance.core.contract.NativeState
import com.metaglance.core.contract.Network
import com.metaglance.core.contract.NotificationPermission
import com.metaglance.core.contract.Registration
import com.metaglance.core.contract.SessionStatus
import com.metaglance.core.contract.StreamStatus

/** Maps the state of the DAT SDK to the two state types of the contract. */
object StateMapper {
    /**
     * `socketExpected` is true while a server session exists. Without one, a closed socket is not "offline".
     * A denied Bluetooth permission gives the registration `UNAVAILABLE`, because the SDK does not run without it.
     * Mock glasses use no Bluetooth, so they keep their registration.
     */
    fun nativeState(
        dat: DatSnapshot,
        phoneOnline: Boolean,
        socketExpected: Boolean,
        socketOpen: Boolean,
        notifications: NotificationPermission
    ): NativeState = NativeState(
        metaAiInstalled = dat.metaAiInstalled,
        registration = if (dat.bluetoothGranted || dat.mock) registration(dat.registration) else Registration.UNAVAILABLE,
        cameraPermission = when (dat.cameraPermission) {
            DatPermission.UNKNOWN -> CameraPermission.UNKNOWN
            DatPermission.GRANTED -> CameraPermission.GRANTED
            DatPermission.DENIED -> CameraPermission.DENIED
        },
        notificationPermission = notifications,
        device = dat.device?.let { device ->
            NativeDevice(
                name = device.name.ifEmpty { null },
                link = link(device),
                battery = battery(device),
                worn = worn(device),
                hingeOpen = hingeOpen(device),
                thermal = thermal(device.thermal),
                updateRequired = device.compatibility == DatCompatibility.DEVICE_UPDATE_REQUIRED || dat.glassesAppUpdateRequired
            )
        },
        session = when (dat.session) {
            DatSession.NONE -> SessionStatus.IDLE
            DatSession.IDLE, DatSession.STARTING -> SessionStatus.STARTING
            DatSession.STARTED -> SessionStatus.STARTED
            DatSession.PAUSED -> SessionStatus.PAUSED
            DatSession.STOPPING, DatSession.STOPPED -> SessionStatus.STOPPED
        },
        stream = stream(dat.stream),
        network = if (!phoneOnline || (socketExpected && !socketOpen)) Network.OFFLINE else Network.ONLINE,
        capabilities = Capabilities(motion = dat.motionStarted, inputs = dat.inputsActive, speech = dat.speechStarted),
        mock = dat.mock
    )

    /**
     * `needed` is false before Android 13, where an app shows notifications with no permission. `asked` is true
     * after the app showed the request of Android one time. Android tells no app if the shopper denied a request,
     * so a permission that is missing after a request counts as denied.
     */
    fun notificationPermission(needed: Boolean, granted: Boolean, asked: Boolean): NotificationPermission = when {
        !needed || granted -> NotificationPermission.GRANTED
        asked -> NotificationPermission.DENIED
        else -> NotificationPermission.UNKNOWN
    }

    /** With no device, the link is `DISCONNECTED` and the four readings are null. */
    fun deviceState(dat: DatSnapshot): DeviceState {
        val device = dat.device
        return DeviceState(
            link = device?.let(::link) ?: Link.DISCONNECTED,
            battery = device?.let(::battery),
            worn = device?.let(::worn),
            hingeOpen = device?.let(::hingeOpen),
            thermal = device?.let { thermal(it.thermal) },
            stream = stream(dat.stream)
        )
    }

    private fun registration(state: DatRegistration): Registration = when (state) {
        DatRegistration.UNAVAILABLE -> Registration.UNAVAILABLE
        DatRegistration.AVAILABLE -> Registration.AVAILABLE
        DatRegistration.REGISTERING, DatRegistration.UNREGISTERING -> Registration.REGISTERING
        DatRegistration.REGISTERED -> Registration.REGISTERED
    }

    private fun link(device: DatDevice): Link = if (device.link == DatLinkState.CONNECTED) Link.CONNECTED else Link.DISCONNECTED

    private fun battery(device: DatDevice): Int? = device.battery.takeIf { it != 0 }

    private fun worn(device: DatDevice): Boolean? = when (device.don) {
        DatDon.UNKNOWN -> null
        DatDon.DOFFED -> false
        DatDon.DONNED -> true
    }

    private fun hingeOpen(device: DatDevice): Boolean? = when (device.hinge) {
        DatHinge.UNKNOWN -> null
        DatHinge.CLOSED -> false
        DatHinge.OPEN -> true
    }

    // The contract has 8 levels from 0 to 7, and the server reads 6 or more as "the glasses cannot stream".
    // The SDK has 7 known levels, so CRITICAL takes 6 and the numbers 2 and 4 stay free.
    private fun thermal(level: DatThermal): Int? = when (level) {
        DatThermal.UNKNOWN -> null
        DatThermal.NONE -> 0
        DatThermal.LIGHT -> 1
        DatThermal.MODERATE -> 3
        DatThermal.SEVERE -> 5
        DatThermal.CRITICAL -> 6
        DatThermal.EMERGENCY, DatThermal.SHUTDOWN -> 7
    }

    private fun stream(state: DatStream): StreamStatus = when (state) {
        DatStream.NONE, DatStream.STOPPING, DatStream.STOPPED, DatStream.CLOSED -> StreamStatus.STOPPED
        DatStream.STARTING, DatStream.STARTED -> StreamStatus.STARTING
        DatStream.STREAMING -> StreamStatus.STREAMING
        DatStream.PAUSED -> StreamStatus.PAUSED
    }
}
