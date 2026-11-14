package com.metaglance.android.bridge

import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.metaglance.core.bridge.Bridge
import com.metaglance.core.contract.Codec
import com.metaglance.core.contract.NativeToPage
import com.metaglance.core.contract.PageToNative

/**
 * The bridge between the app and the page in `webView`. Create it before the page loads, on the main thread.
 * `onMessage` runs on the main thread.
 */
class WebBridge(private val webView: WebView, private val onMessage: (PageToNative) -> Unit) {
    private val main = Handler(Looper.getMainLooper())
    private var ready = false
    private var closed = false

    init {
        webView.addJavascriptInterface(Port(), Bridge.INTERFACE_NAME)
    }

    /** Gives a message to the page. Before the first `ui.ready` of a page, the page has no receiver, and the message is dropped. */
    fun send(message: NativeToPage) {
        if (!ready || closed) return
        webView.evaluateJavascript(Bridge.receiveCall(message), null)
    }

    /** A new page loads. It has no receiver until it sends `ui.ready`. */
    fun onPageStarted() {
        ready = false
    }

    /** Call it before the WebView is destroyed. */
    fun close() {
        closed = true
        webView.removeJavascriptInterface(Bridge.INTERFACE_NAME)
    }

    private fun receive(json: String) {
        if (closed) return
        val message = Codec.decodePageToNative(json)
        if (message == null) {
            Log.w(TAG, "bridge: dropped a page message that the contract does not know: ${json.take(MAX_LOGGED_CHARS)}")
            return
        }
        if (message is PageToNative.UiReady) ready = true
        onMessage(message)
    }

    private inner class Port {
        // The WebView calls this function on a thread of its own.
        @JavascriptInterface
        fun postMessage(json: String) {
            main.post { receive(json) }
        }
    }

    private companion object {
        const val TAG = "Glance"
        const val MAX_LOGGED_CHARS = 120
    }
}
