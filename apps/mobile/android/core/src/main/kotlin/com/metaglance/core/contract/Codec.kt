package com.metaglance.core.contract

import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject

/** The one JSON format of the app. An optional field with the value null is left out, and a nullable field is written as null. */
val GlanceJson: Json = Json {
    classDiscriminator = "t"
    ignoreUnknownKeys = true
}

/** Each decode function returns null for a message that is not of this version and for text that is not JSON. */
object Codec {
    fun encode(message: DeviceToServer): String = GlanceJson.encodeToString(DeviceToServer.serializer(), message)

    fun encode(message: NativeToPage): String = GlanceJson.encodeToString(NativeToPage.serializer(), message)

    fun decodeServerToDevice(text: String): ServerToDevice? = orNull { GlanceJson.decodeFromString(ServerToDevice.serializer(), text) }

    fun decodePageToNative(text: String): PageToNative? = orNull { GlanceJson.decodeFromString(PageToNative.serializer(), text) }

    fun decodeServerEvent(event: JsonObject): ServerEvent? = orNull { GlanceJson.decodeFromJsonElement(ServerEvent.serializer(), event) }

    private inline fun <T> orNull(decode: () -> T): T? = try {
        decode()
    } catch (_: SerializationException) {
        null
    } catch (_: IllegalArgumentException) {
        null
    }
}
