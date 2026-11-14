package com.metaglance.core.contract

import kotlinx.serialization.Serializable

@Serializable
data class CartItem(val productId: String, val name: String, val packSize: String, val qty: Int, val unitPriceCents: Int)

@Serializable
data class Cart(val items: List<CartItem>, val totalCents: Int)
