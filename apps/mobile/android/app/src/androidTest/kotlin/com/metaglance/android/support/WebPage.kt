package com.metaglance.android.support

import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.test.core.app.ActivityScenario
import com.metaglance.android.MainActivity
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue

/** The page in the WebView of "Glance". A test reads it and clicks in it with JavaScript. */
class WebPage(private val scenario: () -> ActivityScenario<MainActivity>) {
    /** Runs JavaScript in the page and returns the result as text. A string result comes back without its quotes. */
    fun js(script: String): String {
        val done = CountDownLatch(1)
        var result = ""
        scenario().onActivity { activity ->
            webView(activity).evaluateJavascript(script) { value ->
                result = value ?: ""
                done.countDown()
            }
        }
        assertTrue("The page did not answer: $script", done.await(JS_MS, TimeUnit.MILLISECONDS))
        return if (result.startsWith("\"")) Json.decodeFromString<String>(result) else result
    }

    /** Clicks the button of the placeholder page with this label. */
    fun clickButton(label: String) {
        val found = js("(() => { const b = [...document.querySelectorAll('#buttons button')].find((x) => x.textContent === '$label'); if (b) b.click(); return !!b; })()")
        assertEquals("The page has no button \"$label\".", "true", found)
    }

    fun text(elementId: String): String = js("document.getElementById('$elementId')?.textContent ?? ''")

    fun awaitText(elementId: String, part: String, timeoutMs: Long = STEP_MS) {
        waitUntil("#$elementId shows $part", timeoutMs, { text(elementId) }) { part in text(elementId) }
    }

    /** The text that a person sees on the page. */
    fun visibleText(): String = js("document.body.innerText")

    fun awaitVisibleText(part: String, timeoutMs: Long = STEP_MS) {
        waitUntil("the page shows \"$part\"", timeoutMs, { visibleText().take(MAX_STATE_CHARS) }) { part in visibleText() }
    }

    fun reload() {
        js("window.__beforeReload = true")
        scenario().onActivity { webView(it).reload() }
        waitUntil("the page loads again", STEP_MS) { js("typeof window.__beforeReload") == "undefined" }
    }

    private fun webView(activity: MainActivity): WebView = checkNotNull(find(activity.findViewById(android.R.id.content))) { "The activity has no WebView." }

    private fun find(view: View): WebView? = when (view) {
        is WebView -> view
        is ViewGroup -> (0 until view.childCount).firstNotNullOfOrNull { find(view.getChildAt(it)) }
        else -> null
    }

    private companion object {
        const val STEP_MS = 10_000L
        const val JS_MS = 5_000L
        const val MAX_STATE_CHARS = 600
    }
}
