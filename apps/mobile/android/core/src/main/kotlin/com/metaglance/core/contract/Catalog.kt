package com.metaglance.core.contract

import kotlinx.serialization.Serializable

/**
 * `allergens`, `vegan`, and `vegetarian` are null for "no data". An empty allergen list means "no allergen".
 * `lookAlikes` holds the IDs of products with a similar package.
 */
@Serializable
data class Product(
    val id: String,
    val gtin: String? = null,
    val name: Localized,
    val spokenName: Localized,
    val brand: String,
    val packSize: String,
    val spokenPack: Localized,
    val spokenPackDetailed: Localized,
    val priceCents: Int,
    val allergens: List<Allergen>?,
    val vegan: Boolean?,
    val vegetarian: Boolean?,
    val visual: String,
    val lookAlikes: List<String> = emptyList()
)

@Serializable
data class ProductRef(val id: String, val name: String, val packSize: String, val priceCents: Int)
