package com.metaglance.core.net

import com.metaglance.core.contract.GlanceJson
import com.metaglance.core.contract.StoreErrorBody
import com.metaglance.core.contract.StoreItemBody
import com.metaglance.core.contract.StoreItemRemovedResponse
import com.metaglance.core.contract.StoreItemResponse
import com.metaglance.core.contract.StoreItemView
import com.metaglance.core.contract.StoreItemsResponse
import com.metaglance.core.contract.StorePicturesResponse
import java.io.IOException
import kotlinx.serialization.DeserializationStrategy
import kotlinx.serialization.SerializationException
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

/** A call of [StoreApi] that failed. `message` is a line for the screen: what failed, and what to do. */
class StoreApiException(message: String, cause: Throwable? = null) : IOException(message, cause)

/**
 * The calls of the debug screen "Add product" to the paths under `/api/store` of the Glance server.
 * They take no key. `baseUrl` is the server address of the app.
 *
 * Each call blocks, so do not call it on the main thread. Each call throws a [StoreApiException] when the server
 * does not answer, for a status that is not 2xx, and for an answer that is not the JSON of the contract.
 * Each `gtin` is a code of 13 digits.
 */
class StoreApi(private val client: OkHttpClient, baseUrl: String) {
    private val baseUrl = baseUrl.trimEnd('/')

    fun items(): StoreItemsResponse = decode(StoreItemsResponse.serializer(), text(Request.Builder().url(items(null)).get().build()))

    /** The item of a code, its pictures, and what Open Food Facts has for the code. */
    fun item(gtin: String): StoreItemResponse = decode(StoreItemResponse.serializer(), text(Request.Builder().url(items(gtin)).get().build()))

    /** Adds the item, or replaces it. */
    fun save(gtin: String, item: StoreItemBody): StoreItemView {
        val body = GlanceJson.encodeToString(StoreItemBody.serializer(), item).toRequestBody(JSON)
        return decode(StoreItemView.serializer(), text(Request.Builder().url(items(gtin)).put(body).build()))
    }

    /** Removes the item and its pictures. */
    fun remove(gtin: String): StoreItemRemovedResponse = decode(StoreItemRemovedResponse.serializer(), text(Request.Builder().url(items(gtin)).delete().build()))

    /** Adds one JPEG as a reference picture of the item. The answer holds each picture of the item. */
    fun addPicture(gtin: String, jpeg: ByteArray): StorePicturesResponse = decode(StorePicturesResponse.serializer(), text(Request.Builder().url(pictures(gtin, null)).post(jpeg.toRequestBody(JPEG)).build()))

    fun removePicture(gtin: String, name: String): StorePicturesResponse = decode(StorePicturesResponse.serializer(), text(Request.Builder().url(pictures(gtin, name)).delete().build(), onePicture = true))

    /** The JPEG of one picture. */
    fun picture(gtin: String, name: String): ByteArray = call(Request.Builder().url(pictures(gtin, name)).get().build(), onePicture = true) { it }

    private fun items(gtin: String?): HttpUrl {
        val base = "$baseUrl/api/store/items".toHttpUrlOrNull()
            ?: throw StoreApiException("The server address is no HTTP address: $baseUrl. Set the Server URL in Glance Mock.")
        return if (gtin == null) base else base.newBuilder().addPathSegment(gtin).build()
    }

    private fun pictures(gtin: String, name: String?): HttpUrl {
        val builder = items(gtin).newBuilder().addPathSegment("pictures")
        return (if (name == null) builder else builder.addPathSegment(name)).build()
    }

    private fun text(request: Request, onePicture: Boolean = false): String = call(request, onePicture) { String(it, Charsets.UTF_8) }

    /** `onePicture` is true for a call with the name of a picture in its path: the status 404 then means that the picture is gone. */
    private fun <T> call(request: Request, onePicture: Boolean, read: (ByteArray) -> T): T {
        val response = try {
            client.newCall(request).execute()
        } catch (e: IOException) {
            throw StoreApiException("No answer from the server at $baseUrl. Check the Server URL in Glance Mock, and that the server runs.", e)
        }
        return response.use {
            val bytes = try {
                it.body?.bytes() ?: ByteArray(0)
            } catch (e: IOException) {
                throw StoreApiException("The answer of the server at $baseUrl broke off. Try again.", e)
            }
            if (!it.isSuccessful) throw StoreApiException(failure(it.code, String(bytes, Charsets.UTF_8), onePicture))
            read(bytes)
        }
    }

    private fun <T> decode(strategy: DeserializationStrategy<T>, text: String): T = try {
        GlanceJson.decodeFromString(strategy, text)
    } catch (e: SerializationException) {
        throw StoreApiException(NOT_THE_CONTRACT, e)
    } catch (e: IllegalArgumentException) {
        throw StoreApiException(NOT_THE_CONTRACT, e)
    }

    companion object {
        private val JSON = "application/json; charset=utf-8".toMediaType()
        private val JPEG = "image/jpeg".toMediaType()
        private const val NOT_THE_CONTRACT = "The answer is not from a Glance server of this version. Check the Server URL in Glance Mock."
        private const val HTTP_NOT_FOUND = 404
        private const val HTTP_TOO_LARGE = 413
        private const val HTTP_SERVER_ERROR = 500
        private val FIELD_NAMES = mapOf("name" to "the name", "priceCents" to "the price", "brand" to "the brand", "packSize" to "the pack size")

        /** The line for the screen for an error status of the server. `body` is the body of the answer. */
        fun failure(status: Int, body: String, onePicture: Boolean = false): String {
            val error = try {
                GlanceJson.decodeFromString(StoreErrorBody.serializer(), body)
            } catch (_: SerializationException) {
                null
            } catch (_: IllegalArgumentException) {
                null
            }
            return when {
                error?.error == "bad_gtin" -> "The server refused the code: its length or its check digit is wrong."
                error?.error == "bad_request" && error.fields.isNotEmpty() -> "The server refused ${error.fields.joinToString(", ") { FIELD_NAMES[it] ?: it }}. Change it and save again."
                error?.error == "no_item" -> "The store does not have this item. Save it first, then add pictures."
                error?.error == "too_many_pictures" -> "This item has the most pictures that the server keeps. Delete one first."
                error?.error == "not_jpeg" || error?.error == "unsupported_media_type" -> "The server takes JPEG pictures only."
                status == HTTP_TOO_LARGE -> "The picture is too large for the server."
                status == HTTP_NOT_FOUND && onePicture -> "The server no longer has this picture."
                status == HTTP_NOT_FOUND -> "This server has no store paths. Update the server, and start it without STORE_EDIT=0."
                status >= HTTP_SERVER_ERROR -> "The server failed with the status $status. Read its log."
                else -> "The server refused the call with the status $status."
            }
        }
    }
}
