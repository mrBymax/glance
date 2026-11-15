package com.metaglance.core.integration

import com.metaglance.core.contract.ProductInfoState
import com.metaglance.core.contract.StoreItemBody
import com.metaglance.core.contract.StoreItemView
import com.metaglance.core.net.StoreApi
import com.metaglance.core.net.StoreApiException
import com.metaglance.core.store.FormCheck
import com.metaglance.core.store.FormSource
import com.metaglance.core.store.StoreItemFields
import com.metaglance.core.store.StoreItemForm
import java.awt.image.BufferedImage
import java.io.ByteArrayOutputStream
import javax.imageio.ImageIO
import okhttp3.OkHttpClient
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Adds a product to the store list of a real Glance server in fake mode, with the real [StoreApi] and the form
 * rules of the screen "Add product". So the Kotlin types and the paths under `/api/store` stay one contract.
 *
 * `scripts/integration/server-kotlin.mjs` starts the server with a copy of the dev store list, and gives its
 * address as the system property `glance.serverUrl`.
 */
class ServerStoreTest {
    private val client = OkHttpClient()
    private val api = StoreApi(client, checkNotNull(System.getProperty("glance.serverUrl")) { "Give the server address as -Pglance.serverUrl." })

    @After fun stop() {
        client.dispatcher.executorService.shutdown()
        client.connectionPool.evictAll()
    }

    private fun jpeg(): ByteArray {
        val out = ByteArrayOutputStream()
        ImageIO.write(BufferedImage(64, 48, BufferedImage.TYPE_INT_RGB), "jpg", out)
        return out.toByteArray()
    }

    @Test fun `adds a new product with a picture, changes it, and removes it`() {
        // The store does not have the code, and the fixtures of the fake product reader have no data for it.
        val before = api.item(NEW)
        assertNull(before.item)
        assertEquals(ProductInfoState.NOT_FOUND, before.productInfo)
        assertEquals(FormSource.NOTHING, StoreItemForm.fill(before).source)
        assertEquals("The store does not have this item. Save it first, then add pictures.", failure { api.addPicture(NEW, jpeg()) })

        val form = StoreItemForm.check(StoreItemFields("Kili  Cascara Yuzu", "2,49", "Kili", "330 ml")) as FormCheck.Ready
        assertEquals(StoreItemView(NEW, "Kili Cascara Yuzu", "Kili", "330 ml", 249, 0), api.save(NEW, form.body))
        assertTrue(api.items().items.any { it.gtin == NEW })

        val picture = jpeg()
        val pictures = api.addPicture(NEW, picture).pictures
        assertEquals(1, pictures.size)
        assertEquals(picture.size.toLong(), pictures[0].bytes)
        assertArrayEquals(picture, api.picture(NEW, pictures[0].name))

        val saved = api.item(NEW)
        assertEquals(StoreItemView(NEW, "Kili Cascara Yuzu", "Kili", "330 ml", 249, 1), saved.item)
        assertEquals(pictures, saved.pictures)
        assertEquals(3, saved.picturesUsed)
        assertEquals(StoreItemFields("Kili Cascara Yuzu", "2.49", "Kili", "330 ml"), StoreItemForm.fill(saved).fields)

        assertEquals(199, api.save(NEW, StoreItemBody("Kili Cascara Yuzu", 199)).priceCents)
        assertNull(api.item(NEW).item?.brand)

        assertEquals(emptyList<Any>(), api.removePicture(NEW, pictures[0].name).pictures)
        assertEquals("The server no longer has this picture.", failure { api.picture(NEW, pictures[0].name) })
        assertTrue(api.remove(NEW).removed)
        assertFalse(api.remove(NEW).removed)
        assertNull(api.item(NEW).item)
    }

    @Test fun `an item of the store fills the form, with the data of the product database beside it`() {
        val answer = api.item("8076800195057")
        assertEquals("Spaghetti n.5", answer.item?.name)
        assertEquals(ProductInfoState.FOUND, answer.productInfo)
        assertEquals("Barilla", answer.suggestion?.brand)
        val filled = StoreItemForm.fill(answer)
        assertEquals(FormSource.STORE, filled.source)
        assertEquals(StoreItemFields("Spaghetti n.5", "1.09", "Barilla", "500 g"), filled.fields)
    }

    @Test fun `the server refuses what the form rules refuse`() {
        assertEquals("The server refused the code: its length or its check digit is wrong.", failure { api.item("8076800195058") })
        assertEquals("The server refused the name. Change it and save again.", failure { api.save(NEW, StoreItemBody(" ", 100)) })
        assertEquals("The server refused the price. Change it and save again.", failure { api.save(NEW, StoreItemBody("Kili", 0)) })
        assertEquals("The server takes JPEG pictures only.", failure { api.addPicture("3017624010701", "not a picture".toByteArray()) })
    }

    private fun failure(call: () -> Unit): String = assertThrows(StoreApiException::class.java) { call() }.message.orEmpty()

    private companion object {
        /** A real code that the dev store list does not hold. */
        const val NEW = "6430062761795"
    }
}
