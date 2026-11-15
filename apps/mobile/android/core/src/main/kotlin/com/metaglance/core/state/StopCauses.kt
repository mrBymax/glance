package com.metaglance.core.state

/** Why a DAT session stopped. The order is the order of the checks in [StopCauses.classify]. */
enum class StopCause { APP, UPDATE_REQUIRED, TOO_WARM, BATTERY, HINGE_CLOSED, LINK_LOST, DEVICE, OTHER }

/**
 * What the app knows when a session stopped. The error sets hold the names of the SDK error constants of this
 * session. `link` and `hinge` are the readings of the device at the stop, or null with no device.
 */
data class StopFacts(
    val requestedByApp: Boolean,
    val sessionErrors: Set<String>,
    val streamErrors: Set<String>,
    val link: DatLinkState?,
    val hinge: DatHinge?
)

object StopCauses {
    /** Returns the first cause that fits. With no fact that names a cause, the result is `OTHER`. */
    fun classify(facts: StopFacts): StopCause {
        fun session(vararg names: String) = names.any { it in facts.sessionErrors }
        fun stream(vararg names: String) = names.any { it in facts.streamErrors }
        return when {
            facts.requestedByApp -> StopCause.APP
            session("DAT_APP_ON_THE_GLASSES_UPDATE_REQUIRED") -> StopCause.UPDATE_REQUIRED
            session("THERMAL_CRITICAL", "THERMAL_EMERGENCY") || stream("THERMAL_HOT") -> StopCause.TOO_WARM
            session("BATTERY_CRITICAL", "PEAK_POWER_SHUTDOWN") || stream("BATTERY_LOW", "PEAK_POWER_LIMIT") -> StopCause.BATTERY
            // Folded glasses also lose the link, so the hinge comes first.
            stream("HINGE_CLOSED") || facts.hinge == DatHinge.CLOSED -> StopCause.HINGE_CLOSED
            session("DEVICE_DISCONNECTED") || facts.link != DatLinkState.CONNECTED -> StopCause.LINK_LOST
            session("SESSION_ENDED_BY_DEVICE") -> StopCause.DEVICE
            else -> StopCause.OTHER
        }
    }

    /** True for a cause that ends by itself: the app starts a new session when the glasses are ready again. */
    fun autoRestart(cause: StopCause): Boolean = cause == StopCause.LINK_LOST || cause == StopCause.HINGE_CLOSED

    /** True for glasses that are connected, not folded, and not off the face. A stream that starts off the face pauses. */
    fun canStartNow(device: DatDevice?): Boolean = device != null &&
        device.link == DatLinkState.CONNECTED &&
        device.hinge != DatHinge.CLOSED &&
        device.don != DatDon.DOFFED
}
