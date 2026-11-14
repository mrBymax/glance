package com.metaglance.android.bridge

import android.content.res.AssetManager
import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader
import com.metaglance.core.bridge.Bridge
import java.io.ByteArrayInputStream
import java.io.IOException
import java.io.InputStream

/**
 * Serves the page from the folder `root` of the APK assets. A path with no file extension that is not a file
 * gives `index.html`, so a route of the page loads after a reload.
 */
class UiAssetsHandler(private val assets: AssetManager, private val root: String) : WebViewAssetLoader.PathHandler {
    override fun handle(path: String): WebResourceResponse {
        val file = path.trimStart('/').ifEmpty { INDEX }
        if (file.split('/').any { it == ".." }) return notFound()
        open(file)?.let { return found(file, it) }
        if (!file.substringAfterLast('/').contains('.')) open(INDEX)?.let { return found(INDEX, it) }
        return notFound()
    }

    private fun open(file: String): InputStream? = try {
        assets.open("$root/$file")
    } catch (_: IOException) {
        null
    }

    private fun found(file: String, body: InputStream): WebResourceResponse {
        val mimeType = Bridge.mimeType(file)
        val isText = mimeType.startsWith("text/") || mimeType.endsWith("json") || mimeType == "image/svg+xml"
        return WebResourceResponse(mimeType, if (isText) "utf-8" else null, body)
    }

    // Without an answer, the WebView asks the network for the file.
    private fun notFound() = WebResourceResponse("text/plain", "utf-8", 404, "Not Found", emptyMap(), ByteArrayInputStream(ByteArray(0)))

    private companion object {
        const val INDEX = "index.html"
    }
}
