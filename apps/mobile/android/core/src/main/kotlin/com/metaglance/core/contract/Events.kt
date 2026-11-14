@file:OptIn(ExperimentalSerializationApi::class)

package com.metaglance.core.contract

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonClassDiscriminator

@Serializable
enum class Phase {
    @SerialName("shopping")
    SHOPPING,

    @SerialName("checkout")
    CHECKOUT,

    @SerialName("paid")
    PAID,

    @SerialName("resting")
    RESTING,

    @SerialName("ended")
    ENDED
}

@Serializable
enum class AimHint {
    @SerialName("none")
    NONE,

    @SerialName("left")
    LEFT,

    @SerialName("right")
    RIGHT,

    @SerialName("up")
    UP,

    @SerialName("down")
    DOWN,

    @SerialName("closer")
    CLOSER,

    @SerialName("farther")
    FARTHER,

    @SerialName("turn")
    TURN
}

@Serializable
enum class SoundName {
    @SerialName("found")
    FOUND,

    @SerialName("added")
    ADDED,

    @SerialName("removed")
    REMOVED,

    @SerialName("warning")
    WARNING,

    @SerialName("paid")
    PAID
}

@Serializable
enum class Priority {
    @SerialName("high")
    HIGH,

    @SerialName("normal")
    NORMAL,

    @SerialName("low")
    LOW
}

@Serializable
data class KioskRef(val id: String, val name: String, val store: String)

@Serializable
enum class Diet {
    @SerialName("vegan")
    VEGAN,

    @SerialName("vegetarian")
    VEGETARIAN
}

// The full names are necessary, because a variant has the name of the top-level type that it holds.
@Serializable
@JsonClassDiscriminator("kind")
sealed interface Warning {
    @Serializable
    @SerialName("allergen")
    data class Allergen(val allergens: List<com.metaglance.core.contract.Allergen>) : Warning

    @Serializable
    @SerialName("diet")
    data class Diet(val diet: com.metaglance.core.contract.Diet) : Warning

    @Serializable
    @SerialName("allergenDataMissing")
    data object AllergenDataMissing : Warning
}

/** `url` is the address of the speech clip, or null when no clip exists. */
@Serializable
data class Caption(val id: String, val text: String, val lang: Lang, val priority: Priority, val url: String?)

/** `paidAt` is an ISO 8601 time. */
@Serializable
data class Receipt(
    val orderId: String,
    val totalCents: Int,
    val paidAt: String,
    val items: List<CartItem>,
    val kiosk: KioskRef
)

@Serializable
enum class PendingKind {
    @SerialName("new")
    NEW,

    @SerialName("inCart")
    IN_CART
}

@Serializable
enum class CartChangeKind {
    @SerialName("add")
    ADD,

    @SerialName("remove")
    REMOVE
}

@Serializable
data class CartChange(val kind: CartChangeKind, val productId: String, val name: String)

@Serializable
@JsonClassDiscriminator("type")
sealed interface ServerEvent {
    @Serializable
    @SerialName("session.state")
    data class SessionState(val phase: Phase, val cameraOn: Boolean) : ServerEvent

    @Serializable
    @SerialName("glance.pending")
    data class GlancePending(
        val promptId: String,
        val kind: PendingKind,
        val product: ProductRef,
        val warnings: List<Warning>,
        val qtyInCart: Int
    ) : ServerEvent

    @Serializable
    @SerialName("glance.cleared")
    data class GlanceCleared(val promptId: String) : ServerEvent

    @Serializable
    @SerialName("glance.hint")
    data class GlanceHint(val aimHint: AimHint) : ServerEvent

    @Serializable
    @SerialName("glance.unknown")
    data object GlanceUnknown : ServerEvent

    @Serializable
    @SerialName("glance.ambiguous")
    data class GlanceAmbiguous(val candidates: List<ProductRef>) : ServerEvent

    @Serializable
    @SerialName("cart.updated")
    data class CartUpdated(val cart: Cart, val change: CartChange?) : ServerEvent

    @Serializable
    @SerialName("budget.exceeded")
    data class BudgetExceeded(val budgetCents: Int, val totalCents: Int) : ServerEvent

    @Serializable
    @SerialName("checkout.offered")
    data class CheckoutOffered(
        val promptId: String,
        val kiosk: KioskRef,
        val totalCents: Int,
        val itemCount: Int,
        val needsBiometric: Boolean
    ) : ServerEvent

    @Serializable
    @SerialName("checkout.suspended")
    data object CheckoutSuspended : ServerEvent

    @Serializable
    @SerialName("checkout.spotcheck")
    data class CheckoutSpotcheck(val product: ProductRef) : ServerEvent

    @Serializable
    @SerialName("checkout.cancelled")
    data object CheckoutCancelled : ServerEvent

    /** The fields of [Receipt]. */
    @Serializable
    @SerialName("checkout.paid")
    data class CheckoutPaid(
        val orderId: String,
        val totalCents: Int,
        val paidAt: String,
        val items: List<CartItem>,
        val kiosk: KioskRef
    ) : ServerEvent

    @Serializable
    @SerialName("checkout.failed")
    data class CheckoutFailed(val reason: String) : ServerEvent

    /** The fields of the top-level `Caption`. */
    @Serializable
    @SerialName("caption")
    data class Caption(val id: String, val text: String, val lang: Lang, val priority: Priority, val url: String?) : ServerEvent

    @Serializable
    @SerialName("error")
    data class Error(val code: String, val message: String) : ServerEvent
}
