package com.metaglance.core.contract

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

// Bodies and answers of the REST calls of spec section 8.1, and the event of the kiosk page.

/** `profile` is a `ProfilePatch` of Plan 0. */
@Serializable
data class CreateSessionRequest(val profile: JsonObject? = null)

@Serializable
data class CreateSessionResponse(val sessionId: String, val token: String, val wsUrl: String)

/** `source` is `PHONE` or `HUD`. */
@Serializable
data class WebIntentRequest(val kind: IntentKind, val source: IntentSource, val promptId: String? = null)

/** The quantity 0 removes the line. */
@Serializable
data class CartEditRequest(val productId: String, val qty: Int)

@Serializable
data class CreateKioskRequest(
    val name: String,
    val store: String,
    val spotCheck: Boolean? = null,
    val failPayment: Boolean? = null
)

@Serializable
data class CreateKioskResponse(val kioskId: String, val token: String, val code: String)

/** The answer of GET /api/demo/latest: the newest live session. */
@Serializable
data class LatestSessionResponse(val sessionId: String, val token: String)

@Serializable
enum class KioskState {
    @SerialName("idle")
    IDLE,

    @SerialName("connected")
    CONNECTED,

    @SerialName("spotcheck")
    SPOTCHECK,

    @SerialName("paid")
    PAID,

    @SerialName("failed")
    FAILED
}

/** `type` is always `kiosk.state`. */
@Serializable
data class KioskEvent(
    val type: String,
    val state: KioskState,
    val kiosk: KioskRef,
    val code: String,
    val cart: Cart?,
    val totalCents: Int?,
    val receipt: Receipt?
)
