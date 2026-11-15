package com.metaglance.android.dat

import com.meta.wearable.dat.camera.types.StreamState
import com.meta.wearable.dat.camera.types.VideoQuality
import com.meta.wearable.dat.core.session.DeviceSessionState
import com.meta.wearable.dat.core.types.DatError
import com.meta.wearable.dat.core.types.Device
import com.meta.wearable.dat.core.types.DeviceCompatibility
import com.meta.wearable.dat.core.types.DonState
import com.meta.wearable.dat.core.types.HingeState
import com.meta.wearable.dat.core.types.LinkState
import com.meta.wearable.dat.core.types.PermissionStatus
import com.meta.wearable.dat.core.types.RegistrationState
import com.meta.wearable.dat.core.types.ThermalLevel
import com.metaglance.core.image.StreamQuality
import com.metaglance.core.state.DatCompatibility
import com.metaglance.core.state.DatDevice
import com.metaglance.core.state.DatDon
import com.metaglance.core.state.DatHinge
import com.metaglance.core.state.DatLinkState
import com.metaglance.core.state.DatPermission
import com.metaglance.core.state.DatRegistration
import com.metaglance.core.state.DatSession
import com.metaglance.core.state.DatStream
import com.metaglance.core.state.DatThermal

// Each :core enum has the constant names of its SDK enum, so valueOf(name) maps one to the other.

internal fun RegistrationState.toCore(): DatRegistration = DatRegistration.valueOf(name)

internal fun LinkState.toCore(): DatLinkState = DatLinkState.valueOf(name)

internal fun DonState.toCore(): DatDon = DatDon.valueOf(name)

internal fun HingeState.toCore(): DatHinge = DatHinge.valueOf(name)

internal fun ThermalLevel.toCore(): DatThermal = DatThermal.valueOf(name)

internal fun DeviceCompatibility.toCore(): DatCompatibility = DatCompatibility.valueOf(name)

internal fun DeviceSessionState.toCore(): DatSession = DatSession.valueOf(name)

internal fun StreamState.toCore(): DatStream = DatStream.valueOf(name)

internal fun StreamQuality.toSdk(): VideoQuality = VideoQuality.valueOf(name)

internal fun PermissionStatus.toCore(): DatPermission = if (this == PermissionStatus.Granted) DatPermission.GRANTED else DatPermission.DENIED

internal fun Device.toCore(): DatDevice = DatDevice(
    name = name,
    link = linkState.toCore(),
    compatibility = compatibility.toCore(),
    battery = batteryLevel,
    don = donState.toCore(),
    hinge = hingeState.toCore(),
    thermal = thermalLevel.toCore()
)

/** The name of the SDK error constant. Most SDK errors are enums. `CaptureError` is a set of objects. */
internal fun DatError.constantName(): String = (this as? Enum<*>)?.name ?: this::class.java.simpleName
