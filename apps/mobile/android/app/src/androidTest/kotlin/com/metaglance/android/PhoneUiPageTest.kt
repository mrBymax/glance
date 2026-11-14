package com.metaglance.android

import androidx.test.ext.junit.runners.AndroidJUnit4
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
import java.io.IOException
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The phone UI of `apps/mobile/ui` in the WebView of the app, with mock glasses and the fake server.
 * It reads the text that a person sees. The test is skipped for an APK that was built without the phone UI:
 * run `npm run build --workspace @glance/phone-ui` at the repository root, then build the APK again.
 *
 * The phone UI has the session screen only. When it gets its setup screen, add that check here.
 */
@RunWith(AndroidJUnit4::class)
class PhoneUiPageTest : MockDeviceKitTestCase<MainActivity>(MainActivity::class.java) {
    private val traffic = TrafficRecorder()
    private val page = WebPage { scenarioRule.scenario }
    private var placeholderBefore = false

    @Before
    override fun setUp() {
        super.setUp()
        assumeTrue("The APK holds no build of the phone UI.", apkHoldsPhoneUi())
        requireFakeServer(BuildConfig.SERVER_URL)
        placeholderBefore = glance.profileStore.usePlaceholder
        onMain {
            glance.session.onPageMessage(PageToNative.DataDelete)
            glance.profileStore.serverUrl = BuildConfig.SERVER_URL
            glance.profileStore.usePlaceholder = false
            glance.session.tap = traffic
        }
        // The activity reads the page selection when it builds its WebView.
        scenarioRule.scenario.recreate()
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
    fun thePageShowsTheProductCardAndAddPutsTheProductInTheCart() {
        page.awaitVisibleText("Glance")
        page.awaitVisibleText("Hold a product up to hear its price.")
        page.awaitVisibleText("Your cart is empty.")

        pairGlasses()
        setCameraFeed(TestClips.SCENE)
        onMain { glance.session.onPageMessage(PageToNative.SessionStart) }
        val pending = waitFor("the product prompt arrives", PROMPT_MS, traffic::summary) { traffic.event<ServerEvent.GlancePending>() }
        assertEquals(PRODUCT_ID, pending.product.id)
        // The card has the name, the pack size, the price, and both buttons, each on a line of its own.
        // The name alone is not enough: the caption of the spoken line holds it too.
        waitUntil("the page shows the product card", STEP_MS, { page.visibleText() }) {
            page.visibleText().lines().map { it.trim() }.containsAll(listOf(pending.product.name, "1 L", "1.89 EUR", "Add", "Skip"))
        }

        assertEquals("The page has no Add button.", "true", clickButton("Add"))
        waitUntil("the page sends a yes with the prompt ID", STEP_MS, traffic::summary) {
            traffic.sent<DeviceToServer.Intent> { it.kind == IntentKind.YES && it.source == IntentSource.PHONE && it.promptId == pending.promptId } != null
        }
        waitFor("the cart gets the product", STEP_MS, traffic::summary) { traffic.event<ServerEvent.CartUpdated> { it.cart.items.isNotEmpty() } }
        waitUntil("the cart of the page shows the product", STEP_MS, { page.visibleText() }) {
            val text = page.visibleText()
            "Your cart is empty." !in text && pending.product.name in text && "Total" in text
        }
    }

    /** Clicks the first button of the page with exactly this text. Returns "true" if the page has one. */
    private fun clickButton(text: String): String = page.js("(() => { const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === '$text'); if (b) b.click(); return !!b; })()")

    private fun apkHoldsPhoneUi(): Boolean = try {
        targetContext.assets.open("ui/index.html").close()
        true
    } catch (_: IOException) {
        false
    }

    private companion object {
        const val PRODUCT_ID = "oat-drink-1l"
        const val STEP_MS = 10_000L
        const val PROMPT_MS = 30_000L
    }
}
