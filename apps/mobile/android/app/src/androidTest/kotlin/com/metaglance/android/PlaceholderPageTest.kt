package com.metaglance.android

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.metaglance.android.session.ProfileStore
import com.metaglance.android.support.MockDeviceKitTestCase
import com.metaglance.android.support.TestClips
import com.metaglance.android.support.TrafficRecorder
import com.metaglance.android.support.WebPage
import com.metaglance.android.support.requireFakeServer
import com.metaglance.android.support.waitFor
import com.metaglance.android.support.waitUntil
import com.metaglance.core.contract.DeviceToServer
import com.metaglance.core.contract.IntentKind
import com.metaglance.core.contract.IntentSource
import com.metaglance.core.contract.PageToNative
import com.metaglance.core.contract.ServerEvent
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
    private val page = WebPage { scenarioRule.scenario }
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
        page.reload()
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
            page.reload()
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

    private fun clickButton(label: String) = page.clickButton(label)

    private fun awaitText(elementId: String, part: String, timeoutMs: Long = STEP_MS) = page.awaitText(elementId, part, timeoutMs)

    private fun js(script: String): String = page.js(script)

    private companion object {
        const val PRODUCT_ID = "oat-drink-1l"
        const val STEP_MS = 10_000L
        const val START_MS = 15_000L
        const val PROMPT_MS = 20_000L
        const val RELOADS = 8
    }
}
