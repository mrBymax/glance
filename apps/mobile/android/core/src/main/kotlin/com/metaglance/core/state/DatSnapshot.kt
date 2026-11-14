package com.metaglance.core.state

// The constants of these enums have the names of the SDK enums. DatMapping in the app maps by name.
enum class DatRegistration { UNAVAILABLE, AVAILABLE, REGISTERING, REGISTERED, UNREGISTERING }

enum class DatPermission { UNKNOWN, GRANTED, DENIED }

enum class DatLinkState { DISCONNECTED, CONNECTING, CONNECTED }

enum class DatDon { UNKNOWN, DOFFED, DONNED }

enum class DatHinge { UNKNOWN, CLOSED, OPEN }

enum class DatThermal { UNKNOWN, NONE, LIGHT, MODERATE, SEVERE, CRITICAL, EMERGENCY, SHUTDOWN }

enum class DatCompatibility { UNDEFINED, COMPATIBLE, DEVICE_UPDATE_REQUIRED, SDK_UPDATE_REQUIRED }

/** `NONE` means that the app holds no session. */
enum class DatSession { NONE, IDLE, STARTING, STARTED, PAUSED, STOPPING, STOPPED }

/** `NONE` means that the app holds no stream. */
enum class DatStream { NONE, STARTING, STARTED, STREAMING, PAUSED, STOPPING, STOPPED, CLOSED }

/** `battery` is a percentage. 0 means that the glasses did not report a level. */
data class DatDevice(
    val name: String,
    val link: DatLinkState,
    val compatibility: DatCompatibility,
    val battery: Int,
    val don: DatDon,
    val hinge: DatHinge,
    val thermal: DatThermal
)

data class DatSnapshot(
    val bluetoothGranted: Boolean,
    val metaAiInstalled: Boolean,
    val registration: DatRegistration,
    val cameraPermission: DatPermission,
    val microphonePermission: DatPermission,
    val device: DatDevice?,
    val session: DatSession,
    val stream: DatStream,
    val motionStarted: Boolean,
    val inputsActive: Boolean,
    val speechStarted: Boolean,
    val glassesAppUpdateRequired: Boolean,
    val mock: Boolean
)

/** One error of the SDK. `name` is the name of the SDK error constant. */
data class DatFault(val area: Area, val name: String) {
    enum class Area { REGISTRATION, PERMISSION, SESSION, STREAM, MOTION, INPUTS, SPEECH, CAPTURE }
}
