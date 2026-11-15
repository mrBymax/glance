package com.metaglance.core.store

import com.metaglance.core.contract.ProductInfoState
import com.metaglance.core.contract.StoreItemBody
import com.metaglance.core.contract.StoreItemResponse
import com.metaglance.core.contract.StoreItemView

/** The texts of the four fields of the product form, as the screen holds them. */
data class StoreItemFields(val name: String = "", val price: String = "", val brand: String = "", val packSize: String = "")

enum class FormField { NAME, PRICE, BRAND, PACK_SIZE }

sealed interface FormCheck {
    /** The body of the save call. */
    data class Ready(val body: StoreItemBody) : FormCheck

    /** One message for each bad field, in the order of the form. */
    data class Invalid(val errors: Map<FormField, String>) : FormCheck
}

/** Where the texts of a filled form come from. */
enum class FormSource { STORE, PRODUCT_DATABASE, NOTHING }

/**
 * The form for a code, as the screen shows it after the answer of the server.
 * `otherNames` holds more names of the product database, for a person who wants another one.
 * `note` is the line above the fields.
 */
data class FilledForm(val fields: StoreItemFields, val source: FormSource, val otherNames: List<String>, val note: String)

/** The rules of the product form. They match the checks of PUT /api/store/items/:gtin, so the server refuses no saved form. */
object StoreItemForm {
    const val NAME_MAX = 80
    const val BRAND_MAX = 80
    const val PACK_SIZE_MAX = 40
    private const val OTHER_NAMES = 3
    private val SPACES = Regex("\\s+")

    /** No space at the ends, and one space between two words, as the server stores a text. */
    fun clean(text: String): String = text.trim().replace(SPACES, " ")

    fun check(fields: StoreItemFields): FormCheck {
        val name = clean(fields.name)
        val brand = clean(fields.brand)
        val packSize = clean(fields.packSize)
        val price = PriceText.parse(fields.price)
        val errors = LinkedHashMap<FormField, String>()
        when {
            name.isEmpty() -> errors[FormField.NAME] = "Type the name."
            name.length > NAME_MAX -> errors[FormField.NAME] = "The name has more than $NAME_MAX characters."
        }
        when (price) {
            is Price.Cents -> Unit
            Price.Empty -> errors[FormField.PRICE] = "Type the price."
            Price.NotAPrice -> errors[FormField.PRICE] = "Type the price in euros, for example 2.49."
            Price.Zero -> errors[FormField.PRICE] = "The price must be above 0."
            Price.TooHigh -> errors[FormField.PRICE] = "The price must be below 10000 euros."
        }
        if (brand.length > BRAND_MAX) errors[FormField.BRAND] = "The brand has more than $BRAND_MAX characters."
        if (packSize.length > PACK_SIZE_MAX) errors[FormField.PACK_SIZE] = "The pack size has more than $PACK_SIZE_MAX characters."
        if (errors.isNotEmpty() || price !is Price.Cents) return FormCheck.Invalid(errors)
        return FormCheck.Ready(StoreItemBody(name, price.value, brand.ifEmpty { null }, packSize.ifEmpty { null }))
    }

    /**
     * Fills the form from the answer for a code. An item of the store gives its own data. For a new code the product
     * database gives a name, a brand, and a pack size that the person can change, and the price stays empty.
     */
    fun fill(answer: StoreItemResponse): FilledForm {
        val item = answer.item
        val suggestion = answer.suggestion
        val names = suggestion?.names.orEmpty().map(::clean).filter { it.isNotEmpty() && it.length <= NAME_MAX }.distinctBy { it.lowercase() }
        if (item != null) {
            val fields = StoreItemFields(item.name, PriceText.format(item.priceCents), item.brand.orEmpty(), item.packSize.orEmpty())
            val others = names.filter { !it.equals(item.name, ignoreCase = true) }.take(OTHER_NAMES)
            return FilledForm(fields, FormSource.STORE, others, withCatalog("The store has this item. Change it and save.", answer))
        }
        if (suggestion == null) {
            val note = if (answer.productInfo == ProductInfoState.FAILED) {
                "New item. Open Food Facts did not answer. Type the data."
            } else {
                "New item. Open Food Facts has no data for this code. Type the data."
            }
            return FilledForm(StoreItemFields(), FormSource.NOTHING, emptyList(), withCatalog(note, answer))
        }
        val fields = StoreItemFields(
            name = names.firstOrNull().orEmpty(),
            brand = clean(suggestion.brand.orEmpty()).take(BRAND_MAX),
            packSize = clean(suggestion.packSize.orEmpty()).take(PACK_SIZE_MAX)
        )
        val note = "New item. The data is from Open Food Facts. Check it and type the price."
        return FilledForm(fields, FormSource.PRODUCT_DATABASE, names.drop(1).take(OTHER_NAMES), withCatalog(note, answer))
    }

    private fun withCatalog(note: String, answer: StoreItemResponse): String {
        val cents = answer.catalogPriceCents ?: return note
        return "$note The catalog has this code at ${PriceText.format(cents)} EUR, and the glasses offer that price."
    }

    /** The first line of an item in the list "Store items": its name, with its brand and pack size when it has them. */
    fun title(item: StoreItemView): String = listOfNotNull(item.name, item.brand, item.packSize).joinToString(", ")

    /** The second line: the price, the picture count, and the code. */
    fun detail(item: StoreItemView): String = "${PriceText.format(item.priceCents)} EUR, ${pictureCount(item.pictures)}, ${item.gtin}"

    fun pictureCount(count: Int): String = if (count == 1) "1 picture" else "$count pictures"

    /** The line above the thumbnails. `used` is the number of pictures that a recognition call takes of one item. */
    fun picturesLine(count: Int, used: Int): String = when {
        count == 0 -> "No picture yet. Recognition uses the newest $used."
        count <= used -> "${pictureCount(count)}. Recognition uses the newest $used."
        else -> "${pictureCount(count)}. Recognition uses the newest $used, so the first $used here."
    }
}
