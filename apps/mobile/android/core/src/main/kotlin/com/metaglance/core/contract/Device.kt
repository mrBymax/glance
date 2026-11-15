@file:OptIn(ExperimentalSerializationApi::class)

package com.metaglance.core.contract

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonClassDiscriminator
import kotlinx.serialization.json.JsonObject

/** `ASK` opens the question window of extra 5. It needs no prompt ID. */
@Serializable
enum class IntentKind {
    @SerialName("yes")
    YES,

    @SerialName("no")
    NO,

    @SerialName("undo")
    UNDO,

    @SerialName("repeat")
    REPEAT,

    @SerialName("total")
    TOTAL,

    @SerialName("cart")
    CART,

    @SerialName("help")
    HELP,

    @SerialName("stop")
    STOP,

    @SerialName("ask")
    ASK
}

@Serializable
enum class IntentSource {
    @SerialName("head")
    HEAD,

    @SerialName("voice")
    VOICE,

    @SerialName("touch")
    TOUCH,

    @SerialName("phone")
    PHONE,

    @SerialName("key")
    KEY,

    @SerialName("camera")
    CAMERA,

    @SerialName("hud")
    HUD
}

/** `StreamState` of Plan 0. The DAT SDK has its own `StreamState`, so this one has another name. */
@Serializable
enum class StreamStatus {
    @SerialName("stopped")
    STOPPED,

    @SerialName("starting")
    STARTING,

    @SerialName("streaming")
    STREAMING,

    @SerialName("paused")
    PAUSED
}

@Serializable
enum class Link {
    @SerialName("connected")
    CONNECTED,

    @SerialName("disconnected")
    DISCONNECTED
}

/** `battery` is from 0 to 100. `thermal` is from 0 to 7, in the order of the DAT thermal levels. */
@Serializable
data class DeviceState(
    val link: Link,
    val battery: Int?,
    val worn: Boolean?,
    val hingeOpen: Boolean?,
    val thermal: Int?,
    val stream: StreamStatus
)

/** `BARCODE` is a code from the barcode decoder. `OCR` is a code from the digits under the bars. */
@Serializable
enum class BarcodeSource {
    @SerialName("barcode")
    BARCODE,

    @SerialName("ocr")
    OCR
}

/**
 * The reason of a `still.request`. `LABEL` is a barcode that the server sees and cannot read.
 * `REFERENCE` is a reference picture of a store item, which a person asked for.
 */
@Serializable
enum class StillPurpose {
    @SerialName("label")
    LABEL,

    @SerialName("reference")
    REFERENCE
}

@Serializable
@JsonClassDiscriminator("t")
sealed interface DeviceToServer {
    @Serializable
    @SerialName("intent")
    data class Intent(val kind: IntentKind, val source: IntentSource, val promptId: String? = null) : DeviceToServer

    @Serializable
    @SerialName("prompt.done")
    data class PromptDone(val promptId: String) : DeviceToServer

    @Serializable
    @SerialName("kiosk.seen")
    data class KioskSeen(val text: String) : DeviceToServer

    /** `code` has 8 to 14 digits, as the phone read it. The server checks it and makes 13 digits of it. */
    @Serializable
    @SerialName("barcode.seen")
    data class BarcodeSeen(val code: String, val source: BarcodeSource) : DeviceToServer

    /** `confidence` is from 0 to 1. The phone sends 0.5 when the glasses give no value. */
    @Serializable
    @SerialName("speech.final")
    data class SpeechFinal(val text: String, val confidence: Double, val locale: String) : DeviceToServer

    @Serializable
    @SerialName("device.state")
    data class DeviceStateChanged(val state: DeviceState) : DeviceToServer

    /** The quantity 0 removes the line. */
    @Serializable
    @SerialName("cart.edit")
    data class CartEdit(val productId: String, val qty: Int) : DeviceToServer

    /** `patch` is a `ProfilePatch` of Plan 0. A typed class cannot tell an absent key from a key with the value null. */
    @Serializable
    @SerialName("profile.set")
    data class ProfileSet(val patch: JsonObject) : DeviceToServer

    @Serializable
    @SerialName("biometric.result")
    data class BiometricResult(val ok: Boolean) : DeviceToServer
}

@Serializable
@JsonClassDiscriminator("t")
sealed interface ServerToDevice {
    /**
     * `url` is null when no clip exists. The phone then reads the text with its own voice.
     * A line with a `promptId` is a prompt. The phone sends `prompt.done` with that ID when the line ends.
     */
    @Serializable
    @SerialName("speak")
    data class Speak(
        val id: String,
        val priority: Priority,
        val text: String,
        val lang: Lang,
        val url: String?,
        val sound: SoundName?,
        val interrupt: Boolean,
        val promptId: String?
    ) : ServerToDevice

    /** `event` is a `ServerEvent`. The app gives it to the page as it is. `Codec.decodeServerEvent` reads it. */
    @Serializable
    @SerialName("event")
    data class Event(val event: JsonObject) : ServerToDevice

    /** `session` is a `SessionSnapshot`. The app gives it to the page as it is. */
    @Serializable
    @SerialName("snapshot")
    data class Snapshot(val session: JsonObject) : ServerToDevice

    @Serializable
    @SerialName("session.rest")
    data object SessionRest : ServerToDevice

    @Serializable
    @SerialName("session.end")
    data object SessionEnd : ServerToDevice

    @Serializable
    @SerialName("biometric.request")
    data object BiometricRequest : ServerToDevice

    /** The server asks for one still. The phone answers with `barcode.seen` or with a frame of the kind `label`. */
    @Serializable
    @SerialName("still.request")
    data class StillRequest(val purpose: StillPurpose) : ServerToDevice
}
