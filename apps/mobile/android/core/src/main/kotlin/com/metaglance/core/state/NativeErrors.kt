package com.metaglance.core.state

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** A failure of the phone. `code` starts with `native.`. The page can show `message` as it is. */
data class NativeError(val code: String, val message: String)

/**
 * `NativeState` has no field for a cause, so the app sends each cause to the page as an `error` event.
 */
object NativeErrors {
    val BLUETOOTH_DENIED = NativeError("native.bluetooth_denied", "Allow Bluetooth to connect your glasses.")
    val REGISTRATION_FAILED = NativeError("native.registration_failed", "The link to Meta AI failed. Try again.")
    val PERMISSION_FAILED = NativeError("native.permission_failed", "The camera request failed. Try again.")
    val NO_DEVICE = NativeError("native.no_device", "Unfold your glasses and keep them near the phone.")
    val NOT_WORN = NativeError("native.not_worn", "Put on your glasses, then start again.")
    val SERVER_UNREACHABLE = NativeError("native.server_unreachable", "The server does not answer. Check the connection.")
    val STOPPED_BY_DEVICE = NativeError("native.stopped_by_device", "The camera stopped on the glasses. Start again when you are ready.")
    val LINK_LOST = NativeError("native.link_lost", "The glasses disconnected. Keep them near the phone.")
    val HINGE_CLOSED = NativeError("native.hinge_closed", "Unfold your glasses to continue.")
    val TOO_WARM = NativeError("native.too_warm", "The glasses are too warm. Please use a regular checkout.")
    val BATTERY_LOW = NativeError("native.battery_low", "The glasses battery is too low. Please use a regular checkout.")
    val UPDATE_REQUIRED = NativeError("native.update_required", "Your glasses need an update.")
    val SDK_TOO_OLD = NativeError("native.sdk_too_old", "This app version is too old for your glasses.")
    val SESSION_FAILED = NativeError("native.session_failed", "The camera did not start. Try again.")
    val BIOMETRIC_UNAVAILABLE = NativeError("native.biometric_unavailable", "Set a screen lock or a fingerprint on this phone first.")

    /** Returns the error of a stop, or null for a stop that the app asked for. */
    fun forStop(cause: StopCause): NativeError? = when (cause) {
        StopCause.APP -> null
        StopCause.UPDATE_REQUIRED -> UPDATE_REQUIRED
        StopCause.TOO_WARM -> TOO_WARM
        StopCause.BATTERY -> BATTERY_LOW
        StopCause.HINGE_CLOSED -> HINGE_CLOSED
        StopCause.LINK_LOST -> LINK_LOST
        StopCause.DEVICE -> STOPPED_BY_DEVICE
        StopCause.OTHER -> SESSION_FAILED
    }

    /** Returns the `error` event of the contract: `{"type":"error","code":"...","message":"..."}`. */
    fun toEvent(error: NativeError): JsonObject = buildJsonObject {
        put("type", "error")
        put("code", error.code)
        put("message", error.message)
    }
}
