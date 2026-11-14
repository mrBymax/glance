@file:OptIn(ExperimentalSerializationApi::class)

package com.metaglance.core.contract

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonClassDiscriminator
import kotlinx.serialization.json.JsonObject

// Wire format in the WebView:
//   Page to Kotlin: window.GlanceNative.postMessage(json), with a PageToNative as a JSON string.
//   Kotlin to page: window.__glanceReceive(json), with a NativeToPage as a JSON string.
// The page sends ui.ready after it sets window.__glanceReceive. Kotlin answers with native.state and profile.
// The phone reports its own failures to the page as error events with a code that starts with "native.".

@Serializable
enum class Registration {
    @SerialName("unavailable")
    UNAVAILABLE,

    @SerialName("available")
    AVAILABLE,

    @SerialName("registering")
    REGISTERING,

    @SerialName("registered")
    REGISTERED
}

@Serializable
enum class CameraPermission {
    @SerialName("unknown")
    UNKNOWN,

    @SerialName("granted")
    GRANTED,

    @SerialName("denied")
    DENIED
}

@Serializable
enum class SessionStatus {
    @SerialName("idle")
    IDLE,

    @SerialName("starting")
    STARTING,

    @SerialName("started")
    STARTED,

    @SerialName("paused")
    PAUSED,

    @SerialName("stopped")
    STOPPED
}

/** `ONLINE` while the device socket to the server is open. */
@Serializable
enum class Network {
    @SerialName("online")
    ONLINE,

    @SerialName("offline")
    OFFLINE
}

/**
 * `battery` is from 0 to 100. `thermal` is from 0 to 7, in the order of the DAT thermal levels.
 * Level 6 and above means that the glasses cannot stream.
 */
@Serializable
data class NativeDevice(
    val name: String?,
    val link: Link,
    val battery: Int?,
    val worn: Boolean?,
    val hingeOpen: Boolean?,
    val thermal: Int?,
    val updateRequired: Boolean
)

@Serializable
data class Capabilities(val motion: Boolean, val inputs: Boolean, val speech: Boolean)

@Serializable
data class NativeState(
    val metaAiInstalled: Boolean,
    val registration: Registration,
    val cameraPermission: CameraPermission,
    val device: NativeDevice?,
    val session: SessionStatus,
    val stream: StreamStatus,
    val network: Network,
    val capabilities: Capabilities,
    val mock: Boolean
)

@Serializable
@JsonClassDiscriminator("t")
sealed interface PageToNative {
    @Serializable
    @SerialName("ui.ready")
    data object UiReady : PageToNative

    @Serializable
    @SerialName("setup.register")
    data object SetupRegister : PageToNative

    @Serializable
    @SerialName("setup.requestCamera")
    data object SetupRequestCamera : PageToNative

    @Serializable
    @SerialName("setup.openUpdate")
    data object SetupOpenUpdate : PageToNative

    @Serializable
    @SerialName("session.start")
    data object SessionStart : PageToNative

    @Serializable
    @SerialName("session.end")
    data object SessionEnd : PageToNative

    @Serializable
    @SerialName("intent")
    data class Intent(val kind: IntentKind, val promptId: String? = null) : PageToNative

    /** The quantity 0 removes the line. */
    @Serializable
    @SerialName("cart.edit")
    data class CartEdit(val productId: String, val qty: Int) : PageToNative

    /** `patch` is a `ProfilePatch` of Plan 0. */
    @Serializable
    @SerialName("profile.set")
    data class ProfileSet(val patch: JsonObject) : PageToNative

    @Serializable
    @SerialName("data.delete")
    data object DataDelete : PageToNative
}

@Serializable
@JsonClassDiscriminator("t")
sealed interface NativeToPage {
    @Serializable
    @SerialName("native.state")
    data class NativeStateChanged(val state: NativeState) : NativeToPage

    @Serializable
    @SerialName("profile")
    data class ProfileChanged(val profile: Profile) : NativeToPage

    /** `event` is a `ServerEvent`. */
    @Serializable
    @SerialName("event")
    data class Event(val event: JsonObject) : NativeToPage

    /** `session` is a `SessionSnapshot`. */
    @Serializable
    @SerialName("snapshot")
    data class Snapshot(val session: JsonObject) : NativeToPage
}
