package com.metaglance.android

import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.metaglance.android.session.ProfileStore
import com.metaglance.android.support.MockDeviceKitTestCase
import com.metaglance.android.support.TestClips
import com.metaglance.android.support.TrafficRecorder
import com.metaglance.android.support.requireFakeServer
import com.metaglance.android.support.waitFor
import com.metaglance.android.support.waitUntil
import com.metaglance.core.contract.DeviceToServer
import com.metaglance.core.contract.IntentKind
import com.metaglance.core.contract.IntentSource
import com.metaglance.core.contract.PageToNative
import com.metaglance.core.contract.ServerEvent
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlinx.serialization.json.Json
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The placeholder page in the WebView of the app: the checks of Plan 2 Task 13 Step 5, and rows 1 to 4 of the
 * spine check of Task 15 Step 3. The two prompt tests need the fake server, as `SpineTest` does.
 */
@RunWith(AndroidJUnit4::class)
class PlaceholderPageTest : MockDeviceKitTestCase<MainActivity>(MainActivity::class.java) {
    private val traffic = TrafficRecorder()
    private var placeholderBefore = false

    @Before
    override fun setUp() {
        super.setUp()
        placeholderBefore = glance.profileStore.usePlaceholder
        onMain {
            glance.session.onPageMessage(PageToNative.DataDelete)
            glance.profileStore.serverUrl = BuildConfig.SERVER_URL
            glance.profileStore.usePlaceholder = true
            glance.session.tap = traffic
        }
        // The activity reads the page selection when it builds its WebView.
        scenarioRule.scenario.recreate()
        awaitText("state", "\"registration\"")
    }

    @After
    override fun tearDown() {
        onMain {
            glance.session.onPageMessage(PageToNative.DataDelete)
            glance.session.tap = null
            glance.profileStore.usePlaceholder = placeholderBefore
        }
        super.tearDown()
    }

    @Test
    fun thePageShowsTheStateAndTheProfile() {
        awaitText("state", "\"mock\": true")
        awaitText("profile", "\"speechRate\": 1")
    }

    @Test
    fun aProfilePatchOfThePageIsStored() {
        clickButton("profile.set speechRate 1.5")
        awaitText("profile", "\"speechRate\": 1.5")
        assertEquals(1.5, ProfileStore(targetContext).profile.speechRate, 0.0)

        scenarioRule.scenario.recreate()
        awaitText("profile", "\"speechRate\": 1.5")
    }

    @Test
    fun theStateShowsThePairedMockGlasses() {
        pairGlasses()
        awaitText("state", "\"link\": \"connected\"")
        awaitText("state", "\"mock\": true")
    }

    @Test
    fun aReloadedPageGetsTheStateAndTheProfileAgain() {
        js("window.__beforeReload = true")
        scenarioRule.scenario.onActivity { webView(it).reload() }
        waitUntil("the page loads again", STEP_MS) { js("typeof window.__beforeReload") == "undefined" }
        awaitText("state", "\"registration\"")
        awaitText("profile", "\"speechRate\"")
    }

    @Test
    fun addOnThePageSendsAYesAndTheCartGetsTheProduct() {
        val promptId = startAndAwaitPrompt()
        js("document.getElementById('add').click()")
        waitUntil("the page sends a yes with the prompt ID", STEP_MS, traffic::summary) {
            traffic.sent<DeviceToServer.Intent> { it.kind == IntentKind.YES && it.source == IntentSource.PHONE && it.promptId == promptId } != null
        }
        val added = waitFor("the cart gets the product", STEP_MS, traffic::summary) { traffic.event<ServerEvent.CartUpdated> { it.cart.items.isNotEmpty() } }
        assertEquals(listOf(PRODUCT_ID), added.cart.items.map { it.productId })
        awaitText("prompt-text", "No prompt.")
        awaitText("captions", "Added")
    }

    @Test
    fun skipOnThePageSendsANoAndTheCartStaysEmpty() {
        val promptId = startAndAwaitPrompt()
        js("document.getElementById('skip').click()")
        waitUntil("the page sends a no with the prompt ID", STEP_MS, traffic::summary) {
            traffic.sent<DeviceToServer.Intent> { it.kind == IntentKind.NO && it.source == IntentSource.PHONE && it.promptId == promptId } != null
        }
        waitUntil("the server ends the prompt", STEP_MS, traffic::summary) { traffic.event<ServerEvent.GlanceCleared> { it.promptId == promptId } != null }
        awaitText("prompt-text", "No prompt.")
        assertTrue("The cart changed: ${traffic.summary()}", traffic.event<ServerEvent.CartUpdated> { it.cart.items.isNotEmpty() } == null)
    }

    @Test
    fun aPageThatLoadsAgainInASessionGetsTheSnapshot() {
        startAndAwaitPrompt()
        // One reload is not enough: the page lost its messages only in some reloads.
        repeat(RELOADS) {
            js("window.__beforeReload = true")
            scenarioRule.scenario.onActivity { webView(it).reload() }
            waitUntil("the page loads again", STEP_MS) { js("typeof window.__beforeReload") == "undefined" }
            awaitText("state", "\"stream\": \"streaming\"")
            awaitText("profile", "\"speechRate\"")
            awaitText("log", "< {\"t\":\"snapshot\"")
        }
    }

    /** Starts a session with the button of the page, and returns the ID of the product prompt that the page shows. */
    private fun startAndAwaitPrompt(): String {
        requireFakeServer(BuildConfig.SERVER_URL)
        pairGlasses()
        setCameraFeed(TestClips.SCENE)
        clickButton("session.start")
        awaitText("state", "\"stream\": \"streaming\"", START_MS)
        val pending = waitFor("the product prompt arrives", PROMPT_MS, traffic::summary) { traffic.event<ServerEvent.GlancePending>() }
        awaitText("prompt-text", "${pending.product.name} (${pending.promptId})")
        waitUntil("prompt.done goes out", STEP_MS, traffic::summary) { traffic.sent<DeviceToServer.PromptDone> { it.promptId == pending.promptId } != null }
        return pending.promptId
    }

    private fun clickButton(label: String) {
        val found = js("(() => { const b = [...document.querySelectorAll('#buttons button')].find((x) => x.textContent === '$label'); if (b) b.click(); return !!b; })()")
        assertEquals("The page has no button \"$label\".", "true", found)
    }

    private fun awaitText(elementId: String, part: String, timeoutMs: Long = STEP_MS) {
        val read = { js("document.getElementById('$elementId')?.textContent ?? ''") }
        waitUntil("#$elementId shows $part", timeoutMs, read) { part in read() }
    }

    /** Runs JavaScript in the page and returns the result as text. A string result comes back without its quotes. */
    private fun js(script: String): String {
        val done = CountDownLatch(1)
        var result = ""
        scenarioRule.scenario.onActivity { activity ->
            webView(activity).evaluateJavascript(script) { value ->
                result = value ?: ""
                done.countDown()
            }
        }
        assertTrue("The page did not answer: $script", done.await(JS_MS, TimeUnit.MILLISECONDS))
        return if (result.startsWith("\"")) Json.decodeFromString<String>(result) else result
    }

    private fun webView(activity: MainActivity): WebView = checkNotNull(find(activity.findViewById(android.R.id.content))) { "The activity has no WebView." }

    private fun find(view: View): WebView? = when (view) {
        is WebView -> view
        is ViewGroup -> (0 until view.childCount).firstNotNullOfOrNull { find(view.getChildAt(it)) }
        else -> null
    }

    private companion object {
        const val PRODUCT_ID = "oat-drink-1l"
        const val STEP_MS = 10_000L
        const val START_MS = 15_000L
        const val PROMPT_MS = 20_000L
        const val JS_MS = 5_000L
        const val RELOADS = 8
    }
}
