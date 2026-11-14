package com.metaglance.core.bridge

import com.metaglance.core.contract.Codec
import com.metaglance.core.contract.GlanceJson
import com.metaglance.core.contract.NativeToPage
import kotlinx.serialization.builtins.serializer

/** The text side of the bridge between the app and the page in its WebView. */
object Bridge {
    /** The page sends a message with `window.GlanceNative.postMessage(json)`. */
    const val INTERFACE_NAME = "GlanceNative"

    /**
     * Returns the JavaScript that gives a message to the page: `window.__glanceReceive("<JSON>")`.
     * The argument is the JSON text of the message as one string literal. A JSON string is also a JavaScript
     * string, so the escapes of the JSON encoder are enough.
     */
    fun receiveCall(message: NativeToPage): String = "window.__glanceReceive(" + GlanceJson.encodeToString(String.serializer(), Codec.encode(message)) + ")"

    /** Returns the MIME type for the file extension of `path`. A module script loads only with a JavaScript type. */
    fun mimeType(path: String): String {
        val extension = path.substringAfterLast('/').substringAfterLast('.', "").lowercase()
        return MIME_TYPES[extension] ?: "application/octet-stream"
    }

    private val MIME_TYPES = mapOf(
        "html" to "text/html",
        "js" to "text/javascript",
        "mjs" to "text/javascript",
        "css" to "text/css",
        "json" to "application/json",
        "map" to "application/json",
        "webmanifest" to "application/manifest+json",
        "txt" to "text/plain",
        "svg" to "image/svg+xml",
        "png" to "image/png",
        "jpg" to "image/jpeg",
        "jpeg" to "image/jpeg",
        "webp" to "image/webp",
        "ico" to "image/x-icon",
        "woff" to "font/woff",
        "woff2" to "font/woff2",
        "ttf" to "font/ttf",
        "wasm" to "application/wasm",
        "mp3" to "audio/mpeg",
        "wav" to "audio/wav"
    )
}
