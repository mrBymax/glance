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

    /**
     * Gives a message to the page. Nothing goes out before the first `ui.ready`. A page that loads again has no
     * receiver until its own `ui.ready`: a message in that time is dropped in the page, and the answer to
     * `ui.ready` brings the state again.
     *
     * The bridge does not use `onPageStarted` to know that a page has no receiver yet. Measured on a Nothing Phone (1):
     * for a page that loads again, that call and the `ui.ready` of the new page are 1 to 7 ms apart, and in 2 of 20
     * loads the page posted `ui.ready` first. A flag that `onPageStarted` clears can so stay cleared for the new page.
     * In one test run a page that loaded again got its state and then no snapshot.
     */
    fun send(message: NativeToPage) {
        if (!ready || closed) return
        webView.evaluateJavascript("if (window.__glanceReceive) " + Bridge.receiveCall(message), null)
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
