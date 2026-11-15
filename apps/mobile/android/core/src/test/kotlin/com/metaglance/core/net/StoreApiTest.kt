package com.metaglance.core.net

import com.metaglance.core.contract.ProductInfoState
import com.metaglance.core.contract.ProductSuggestion
import com.metaglance.core.contract.StoreItemBody
import com.metaglance.core.contract.StoreItemRemovedResponse
import com.metaglance.core.contract.StoreItemView
import com.metaglance.core.contract.StorePicture
import com.metaglance.core.contract.StorePicturesResponse
import java.net.InetAddress
import java.util.concurrent.TimeUnit
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.SocketPolicy
import okio.Buffer
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class StoreApiTest {
    private val server = MockWebServer()
    private val client = OkHttpClient.Builder().readTimeout(300, TimeUnit.MILLISECONDS).build()
    private lateinit var api: StoreApi
    private lateinit var base: String

    @Before fun start() {
        server.start(InetAddress.getByName("127.0.0.1"), 0)
        base = "http://127.0.0.1:${server.port}"
        api = StoreApi(client, "$base/")
    }

    @After fun stop() {
        server.shutdown()
        client.dispatcher.executorService.shutdown()
        client.connectionPool.evictAll()
    }

    private fun failure(call: () -> Unit): String = assertThrows(StoreApiException::class.java) { call() }.message.orEmpty()

    @Test fun `lists the items of the store`() {
        server.enqueue(MockResponse().setBody("""{"items":[{"gtin":"3017624010701","name":"Nutella","brand":"Ferrero","packSize":"400 g","priceCents":399,"pictures":2},{"gtin":"2000000000015","name":"Bread","brand":null,"packSize":null,"priceCents":150,"pictures":0}]}"""))
        val items = api.items().items
        assertEquals(StoreItemView("3017624010701", "Nutella", "Ferrero", "400 g", 399, 2), items[0])
        assertEquals(StoreItemView("2000000000015", "Bread", null, null, 150, 0), items[1])
        assertEquals("GET /api/store/items HTTP/1.1", server.takeRequest().requestLine)
    }

    @Test fun `reads one item with its pictures and the suggestion of the product database`() {
        server.enqueue(
            MockResponse().setBody(
                """{"gtin":"8076800195057","item":null,"pictures":[{"name":"1794710571331.jpg","bytes":9,"addedAt":1794710571331}],"picturesUsed":3,""" +
                    """"productInfo":"found","suggestion":{"names":["Spaghetti n.5"],"brand":"Barilla","packSize":"500 g","allergens":["gluten"],"vegan":null,"vegetarian":true},""" +
                    """"catalogPriceCents":null,"later":"a field of a newer server"}"""
            )
        )
        val answer = api.item("8076800195057")
        assertNull(answer.item)
        assertEquals(listOf(StorePicture("1794710571331.jpg", 9, 1794710571331)), answer.pictures)
        assertEquals(3, answer.picturesUsed)
        assertEquals(ProductInfoState.FOUND, answer.productInfo)
        assertEquals(ProductSuggestion(listOf("Spaghetti n.5"), "Barilla", "500 g", listOf("gluten"), null, true), answer.suggestion)
        assertNull(answer.catalogPriceCents)
        assertEquals("/api/store/items/8076800195057", server.takeRequest().path)
    }

    @Test fun `reads an item with no suggestion`() {
        server.enqueue(
            MockResponse().setBody(
                """{"gtin":"7394376616037","item":{"gtin":"7394376616037","name":"Barista oat drink","brand":"Oatly","packSize":"1 L","priceCents":259,"pictures":0},""" +
                    """"pictures":[],"picturesUsed":3,"productInfo":"failed","suggestion":null,"catalogPriceCents":229}"""
            )
        )
        val answer = api.item("7394376616037")
        assertEquals(259, answer.item?.priceCents)
        assertEquals(ProductInfoState.FAILED, answer.productInfo)
        assertEquals(229, answer.catalogPriceCents)
    }

    @Test fun `saves an item as JSON, and leaves out a field with no value`() {
        server.enqueue(MockResponse().setResponseCode(201).setBody("""{"gtin":"2000000000015","name":"Bread","brand":null,"packSize":null,"priceCents":150,"pictures":0}"""))
        server.enqueue(MockResponse().setBody("""{"gtin":"6430062761795","name":"Kili","brand":"Kili","packSize":"330 ml","priceCents":249,"pictures":1}"""))
        assertEquals(StoreItemView("2000000000015", "Bread", null, null, 150, 0), api.save("2000000000015", StoreItemBody("Bread", 150)))
        val first = server.takeRequest()
        assertEquals("PUT /api/store/items/2000000000015 HTTP/1.1", first.requestLine)
        assertEquals("application/json; charset=utf-8", first.getHeader("content-type"))
        assertEquals("""{"name":"Bread","priceCents":150}""", first.body.readUtf8())

        assertEquals(1, api.save("6430062761795", StoreItemBody("Kili", 249, "Kili", "330 ml")).pictures)
        assertEquals("""{"name":"Kili","priceCents":249,"brand":"Kili","packSize":"330 ml"}""", server.takeRequest().body.readUtf8())
    }

    @Test fun `removes an item`() {
        server.enqueue(MockResponse().setBody("""{"gtin":"3017624010701","removed":true,"pictures":2}"""))
        assertEquals(StoreItemRemovedResponse("3017624010701", removed = true, pictures = 2), api.remove("3017624010701"))
        assertEquals("DELETE /api/store/items/3017624010701 HTTP/1.1", server.takeRequest().requestLine)
    }

    @Test fun `sends a picture as a JPEG body, reads one back, and removes one by its name`() {
        val jpeg = byteArrayOf(0xff.toByte(), 0xd8.toByte(), 0xff.toByte(), 0xe0.toByte(), 1, 2, 3)
        val one = """{"gtin":"3017624010701","pictures":[{"name":"17.jpg","bytes":7,"addedAt":17}]}"""
        server.enqueue(MockResponse().setResponseCode(201).setBody(one))
        server.enqueue(MockResponse().setHeader("content-type", "image/jpeg").setBody(Buffer().write(jpeg)))
        server.enqueue(MockResponse().setBody("""{"gtin":"3017624010701","pictures":[]}"""))

        assertEquals(StorePicturesResponse("3017624010701", listOf(StorePicture("17.jpg", 7, 17))), api.addPicture("3017624010701", jpeg))
        val sent = server.takeRequest()
        assertEquals("POST /api/store/items/3017624010701/pictures HTTP/1.1", sent.requestLine)
        assertEquals("image/jpeg", sent.getHeader("content-type"))
        assertArrayEquals(jpeg, sent.body.readByteArray())

        assertArrayEquals(jpeg, api.picture("3017624010701", "17.jpg"))
        assertEquals("/api/store/items/3017624010701/pictures/17.jpg", server.takeRequest().path)

        assertEquals(emptyList<StorePicture>(), api.removePicture("3017624010701", "front of pack.jpg").pictures)
        // A name with a space or a slash stays one part of the path.
        assertEquals("DELETE /api/store/items/3017624010701/pictures/front%20of%20pack.jpg HTTP/1.1", server.takeRequest().requestLine)
        assertEquals("$base/api/store/items/1/pictures/a%2Fb.jpg", pathOf { api.picture("1", "a/b.jpg") })
    }

    private fun pathOf(call: () -> Unit): String {
        server.enqueue(MockResponse().setBody("x"))
        call()
        return base + server.takeRequest().path
    }

    @Test fun `says that the server does not answer, with its address`() {
        server.shutdown()
        val message = failure { api.items() }
        assertEquals("No answer from the server at $base. Check the Server URL in Glance Mock, and that the server runs.", message)
    }

    @Test fun `a server that is too slow counts as no answer`() {
        server.enqueue(MockResponse().setSocketPolicy(SocketPolicy.NO_RESPONSE))
        assertTrue(failure { api.item("3017624010701") }.startsWith("No answer from the server"))
    }

    @Test fun `says that the address is no address`() {
        val message = failure { StoreApi(client, "192.168.1.20:8080").items() }
        assertEquals("The server address is no HTTP address: 192.168.1.20:8080. Set the Server URL in Glance Mock.", message)
    }

    @Test fun `gives the reason of each error status`() {
        fun after(status: Int, body: String, call: () -> Unit): String {
            server.enqueue(MockResponse().setResponseCode(status).setBody(body))
            return failure(call)
        }
        val bread = StoreItemBody("Bread", 150)
        assertEquals(
            "The server refused the code: its length or its check digit is wrong.",
            after(400, """{"error":"bad_gtin"}""") { api.item("123") }
        )
        assertEquals(
            "The server refused the name, the price. Change it and save again.",
            after(400, """{"error":"bad_request","fields":["name","priceCents"]}""") { api.save("2000000000015", bread) }
        )
        assertEquals(
            "The store does not have this item. Save it first, then add pictures.",
            after(409, """{"error":"no_item"}""") { api.addPicture("2000000000015", ByteArray(4)) }
        )
        assertEquals(
            "This item has the most pictures that the server keeps. Delete one first.",
            after(409, """{"error":"too_many_pictures"}""") { api.addPicture("2000000000015", ByteArray(4)) }
        )
        assertEquals("The server takes JPEG pictures only.", after(400, """{"error":"not_jpeg"}""") { api.addPicture("2000000000015", ByteArray(4)) })
        assertEquals("The picture is too large for the server.", after(413, """{"error":"too_large"}""") { api.addPicture("2000000000015", ByteArray(4)) })
        assertEquals(
            "This server has no store paths. Update the server, and start it without STORE_EDIT=0.",
            after(404, """{"error":"not_found"}""") { api.items() }
        )
        assertEquals("The server no longer has this picture.", after(404, """{"error":"not_found"}""") { api.picture("2000000000015", "17.jpg") })
        assertEquals("The server no longer has this picture.", after(404, """{"error":"not_found"}""") { api.removePicture("2000000000015", "17.jpg") })
        assertEquals("The server failed with the status 500. Read its log.", after(500, """{"error":"internal"}""") { api.save("2000000000015", bread) })
        assertEquals("The server failed with the status 502. Read its log.", after(502, "<html>Bad Gateway</html>") { api.items() })
        assertEquals("The server refused the call with the status 400.", after(400, """{"error":"bad_request"}""") { api.save("2000000000015", bread) })
    }

    @Test fun `an answer that is not the JSON of the contract names the server address setting`() {
        val expected = "The answer is not from a Glance server of this version. Check the Server URL in Glance Mock."
        server.enqueue(MockResponse().setBody("<html>router login</html>"))
        assertEquals(expected, failure { api.items() })
        server.enqueue(MockResponse().setBody("""{"gtin":"3017624010701"}"""))
        assertEquals(expected, failure { api.item("3017624010701") })
    }
}
