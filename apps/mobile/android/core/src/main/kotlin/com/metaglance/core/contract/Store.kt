package com.metaglance.core.contract

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// Bodies and answers of the paths under /api/store of the server: `apps/server/src/http/store.ts`.
// The debug screen "Add product" uses them. The prices are in cents.

/** One item of the store list. `pictures` is the number of its reference pictures. */
@Serializable
data class StoreItemView(
    val gtin: String,
    val name: String,
    val brand: String?,
    val packSize: String?,
    val priceCents: Int,
    val pictures: Int
)

@Serializable
data class StoreItemsResponse(val items: List<StoreItemView>)

/** One reference picture of an item. `name` is the last part of the path that gives its JPEG. */
@Serializable
data class StorePicture(val name: String, val bytes: Long, val addedAt: Long)

/** What Open Food Facts has for a code. `names` holds the names in each language that it has. */
@Serializable
data class ProductSuggestion(
    val names: List<String>,
    val brand: String?,
    val packSize: String?,
    val allergens: List<String>?,
    val vegan: Boolean?,
    val vegetarian: Boolean?
)

/** `FAILED`: the server could not read Open Food Facts. `NOT_FOUND` also for a code of one store. */
@Serializable
enum class ProductInfoState {
    @SerialName("found")
    FOUND,

    @SerialName("not_found")
    NOT_FOUND,

    @SerialName("failed")
    FAILED
}

/**
 * The answer of GET /api/store/items/:gtin. `item` is null when the store does not have the code.
 * `picturesUsed` is the number of pictures of one item that a recognition call uses.
 * `catalogPriceCents` is the price of the catalog product with this code, which wins over the price of the item.
 */
@Serializable
data class StoreItemResponse(
    val gtin: String,
    val item: StoreItemView?,
    val pictures: List<StorePicture>,
    val picturesUsed: Int,
    val productInfo: ProductInfoState,
    val suggestion: ProductSuggestion?,
    val catalogPriceCents: Int?
)

/** The body of PUT /api/store/items/:gtin. */
@Serializable
data class StoreItemBody(val name: String, val priceCents: Int, val brand: String? = null, val packSize: String? = null)

/** The answer of each call that changes the pictures of an item: the pictures that it has now, newest first. */
@Serializable
data class StorePicturesResponse(val gtin: String, val pictures: List<StorePicture>)

/** `removed` is false when the store did not have the code. `pictures` is the number of removed pictures. */
@Serializable
data class StoreItemRemovedResponse(val gtin: String, val removed: Boolean, val pictures: Int)

/** The body of an answer with an error status. `fields` names the bad fields of a refused item. */
@Serializable
data class StoreErrorBody(val error: String, val fields: List<String> = emptyList())
