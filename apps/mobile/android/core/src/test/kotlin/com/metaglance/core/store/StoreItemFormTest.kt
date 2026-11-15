package com.metaglance.core.store

import com.metaglance.core.contract.ProductInfoState
import com.metaglance.core.contract.ProductSuggestion
import com.metaglance.core.contract.StoreItemBody
import com.metaglance.core.contract.StoreItemResponse
import com.metaglance.core.contract.StoreItemView
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class StoreItemFormTest {
    private val nutella = StoreItemView("3017624010701", "Nutella", "Ferrero", "400 g", 399, 2)
    private val suggestion = ProductSuggestion(
        names = listOf("  Spaghetti   n.5 ", "spaghetti N.5", "Spaghetti No. 5", "Pasta di semola", "Durum wheat pasta", "Hartweizennudeln"),
        brand = "Barilla",
        packSize = "500 g",
        allergens = listOf("gluten"),
        vegan = true,
        vegetarian = true
    )

    private fun answer(
        item: StoreItemView? = null,
        suggestion: ProductSuggestion? = null,
        state: ProductInfoState = if (suggestion == null) ProductInfoState.NOT_FOUND else ProductInfoState.FOUND,
        catalogPriceCents: Int? = null
    ) = StoreItemResponse(item?.gtin ?: "8076800195057", item, emptyList(), 3, state, suggestion, catalogPriceCents)

    private fun errors(fields: StoreItemFields): Map<FormField, String> = (StoreItemForm.check(fields) as FormCheck.Invalid).errors

    @Test fun `a form with a name and a price is the body of the save call`() {
        val check = StoreItemForm.check(StoreItemFields("  Kili   Cascara Yuzu ", "2,49", " Kili ", "330 ml"))
        assertEquals(FormCheck.Ready(StoreItemBody("Kili Cascara Yuzu", 249, "Kili", "330 ml")), check)
    }

    @Test fun `an empty brand and an empty pack size are left out`() {
        assertEquals(FormCheck.Ready(StoreItemBody("Bread", 150)), StoreItemForm.check(StoreItemFields("Bread", "1.5", "  ", "")))
    }

    @Test fun `names each bad field with what to do, in the order of the form`() {
        assertEquals(
            mapOf(FormField.NAME to "Type the name.", FormField.PRICE to "Type the price."),
            errors(StoreItemFields(name = "   "))
        )
        assertEquals(mapOf(FormField.PRICE to "Type the price in euros, for example 2.49."), errors(StoreItemFields("Bread", "two")))
        assertEquals(mapOf(FormField.PRICE to "The price must be above 0."), errors(StoreItemFields("Bread", "0.00")))
        assertEquals(mapOf(FormField.PRICE to "The price must be below 10000 euros."), errors(StoreItemFields("Bread", "10000")))
        val long = errors(StoreItemFields("n".repeat(81), "1", "b".repeat(81), "p".repeat(41)))
        assertEquals(listOf(FormField.NAME, FormField.BRAND, FormField.PACK_SIZE), long.keys.toList())
        assertEquals("The name has more than 80 characters.", long[FormField.NAME])
    }

    @Test fun `takes texts at the limits of the server`() {
        val check = StoreItemForm.check(StoreItemFields("n".repeat(80), "9999.99", "b".repeat(80), "p".repeat(40)))
        assertEquals(999_999, (check as FormCheck.Ready).body.priceCents)
    }

    @Test fun `an item of the store fills the form with its own data`() {
        val filled = StoreItemForm.fill(answer(item = nutella, suggestion = suggestion.copy(names = listOf("Nutella", "Pâte à tartiner"))))
        assertEquals(StoreItemFields("Nutella", "3.99", "Ferrero", "400 g"), filled.fields)
        assertEquals(FormSource.STORE, filled.source)
        assertEquals(listOf("Pâte à tartiner"), filled.otherNames)
        assertEquals("The store has this item. Change it and save.", filled.note)
        assertEquals(FormCheck.Ready(StoreItemBody("Nutella", 399, "Ferrero", "400 g")), StoreItemForm.check(filled.fields))
    }

    @Test fun `a new code gets the name, the brand, and the pack size of the product database, and no price`() {
        val filled = StoreItemForm.fill(answer(suggestion = suggestion))
        assertEquals(StoreItemFields("Spaghetti n.5", "", "Barilla", "500 g"), filled.fields)
        assertEquals(FormSource.PRODUCT_DATABASE, filled.source)
        // The same name in another case counts one time, and the form offers three more names.
        assertEquals(listOf("Spaghetti No. 5", "Pasta di semola", "Durum wheat pasta"), filled.otherNames)
        assertEquals("New item. The data is from Open Food Facts. Check it and type the price.", filled.note)
    }

    @Test fun `a suggestion with no name, and texts above the limits, still give a form that the server takes`() {
        val odd = suggestion.copy(names = listOf(" ", "x".repeat(81)), brand = "b".repeat(90), packSize = null)
        val filled = StoreItemForm.fill(answer(suggestion = odd))
        assertEquals(StoreItemFields("", "", "b".repeat(80), ""), filled.fields)
        assertEquals(emptyList<String>(), filled.otherNames)
    }

    @Test fun `a code with no data gets an empty form, and the note says why`() {
        val none = StoreItemForm.fill(answer())
        assertEquals(StoreItemFields(), none.fields)
        assertEquals(FormSource.NOTHING, none.source)
        assertEquals("New item. Open Food Facts has no data for this code. Type the data.", none.note)
        assertEquals("New item. Open Food Facts did not answer. Type the data.", StoreItemForm.fill(answer(state = ProductInfoState.FAILED)).note)
    }

    @Test fun `the note tells the price of a catalog product with the code`() {
        val note = StoreItemForm.fill(answer(item = nutella, catalogPriceCents = 229)).note
        assertTrue(note, note.endsWith("The catalog has this code at 2.29 EUR, and the glasses offer that price."))
    }

    @Test fun `writes the lines of an item and of its pictures`() {
        assertEquals("Nutella, Ferrero, 400 g", StoreItemForm.title(nutella))
        assertEquals("Bread", StoreItemForm.title(nutella.copy(name = "Bread", brand = null, packSize = null)))
        assertEquals("3.99 EUR, 2 pictures, 3017624010701", StoreItemForm.detail(nutella))
        assertEquals("3.99 EUR, 1 picture, 3017624010701", StoreItemForm.detail(nutella.copy(pictures = 1)))
        assertEquals("No picture yet. Recognition uses the newest 3.", StoreItemForm.picturesLine(0, 3))
        assertEquals("2 pictures. Recognition uses the newest 3.", StoreItemForm.picturesLine(2, 3))
        assertEquals("5 pictures. Recognition uses the newest 3, so the first 3 here.", StoreItemForm.picturesLine(5, 3))
    }
}
