package com.metaglance.core.net

import com.metaglance.core.contract.CreateSessionRequest
import com.metaglance.core.contract.CreateSessionResponse
import com.metaglance.core.contract.GlanceJson
import com.metaglance.core.contract.Profile
import java.io.IOException
import java.net.URI
import java.net.URISyntaxException
import kotlinx.serialization.DeserializationStrategy
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

/**
 * The REST calls of the app to the Glance server (spec section 8.1). `baseUrl` is the server address that the
 * app was built with, for example `https://glance.example`.
 *
 * Each call blocks, so do not call it on the main thread. Each call throws an [IOException] for a status that
 * is not 2xx, and for an answer that is not the JSON of the contract.
 */
class GlanceApi(private val client: OkHttpClient, baseUrl: String) {
    private val baseUrl = baseUrl.trimEnd('/')

    fun createSession(profile: Profile): CreateSessionResponse {
        val request = CreateSessionRequest(GlanceJson.encodeToJsonElement(Profile.serializer(), profile).jsonObject)
        val body = GlanceJson.encodeToString(CreateSessionRequest.serializer(), request).toRequestBody(JSON)
        return decode(CreateSessionResponse.serializer(), call(Request.Builder().url(sessions()).post(body).build()))
    }

    /** Returns the `SessionSnapshot` of the session as JSON. The app gives it to the page as it is. */
    fun snapshot(sessionId: String, token: String): JsonObject = decode(JsonObject.serializer(), call(Request.Builder().url(session(sessionId, token)).get().build()))

    fun deleteSession(sessionId: String, token: String) {
        call(Request.Builder().url(session(sessionId, token)).delete().build())
    }

    /**
     * Returns the socket address on `baseUrl`, with `ws` for `http` and `wss` for `https`. Only the path and the
     * query of `wsUrl` stay: the server builds it from its own public address, and that can be `localhost`.
     */
    fun socketUrl(wsUrl: String): String = "ws" + baseUrl.removePrefix("http") + pathAndQuery(wsUrl)

    /**
     * Returns the address of a speech clip on `baseUrl`. `url` is a full address, or a path that starts with `/`.
     * This function and [socketUrl] throw an [IllegalArgumentException] for a text that is not an address.
     */
    fun clipUrl(url: String): String = baseUrl + pathAndQuery(url)

    // The server address is a setting of the app. A wrong one fails like a server that does not answer.
    private fun sessions(): HttpUrl = "$baseUrl/api/sessions".toHttpUrlOrNull() ?: throw IOException("The server address is not an HTTP address: $baseUrl")

    private fun session(sessionId: String, token: String): HttpUrl = sessions().newBuilder().addPathSegment(sessionId).addQueryParameter("token", token).build()

    private fun call(request: Request): String = client.newCall(request).execute().use { response ->
        if (!response.isSuccessful) throw IOException("${request.method} ${request.url.encodedPath} gave the status ${response.code}.")
        response.body?.string().orEmpty()
    }

    private fun <T> decode(strategy: DeserializationStrategy<T>, text: String): T = try {
        GlanceJson.decodeFromString(strategy, text)
    } catch (e: SerializationException) {
        throw IOException("The answer of the server is not the JSON of the contract.", e)
    } catch (e: IllegalArgumentException) {
        throw IOException("The answer of the server is not the JSON of the contract.", e)
    }

    private fun pathAndQuery(url: String): String {
        val uri = try {
            URI(url)
        } catch (e: URISyntaxException) {
            throw IllegalArgumentException("The server sent an address that is not an address: $url", e)
        }
        return uri.rawPath.orEmpty() + (uri.rawQuery?.let { "?$it" } ?: "")
    }

    private companion object {
        val JSON = "application/json; charset=utf-8".toMediaType()
    }
}
