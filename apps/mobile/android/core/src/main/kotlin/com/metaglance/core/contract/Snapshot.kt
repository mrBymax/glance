@file:OptIn(ExperimentalSerializationApi::class)

package com.metaglance.core.contract

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonClassDiscriminator

@Serializable
@JsonClassDiscriminator("kind")
sealed interface CurrentPrompt {
    @Serializable
    @SerialName("product")
    data class Product(
        val promptId: String,
        val mode: PendingKind,
        val product: ProductRef,
        val warnings: List<Warning>,
        val qtyInCart: Int
    ) : CurrentPrompt

    @Serializable
    @SerialName("pay")
    data class Pay(
        val promptId: String,
        val kiosk: KioskRef,
        val totalCents: Int,
        val itemCount: Int,
        val needsBiometric: Boolean
    ) : CurrentPrompt
}

/** `captions` holds the last 20, oldest first. */
@Serializable
data class SessionSnapshot(
    val sessionId: String,
    val phase: Phase,
    val cameraOn: Boolean,
    val prompt: CurrentPrompt?,
    val cart: Cart,
    val profile: Profile,
    val kiosk: KioskRef?,
    val lastReceipt: Receipt?,
    val captions: List<Caption>
)
