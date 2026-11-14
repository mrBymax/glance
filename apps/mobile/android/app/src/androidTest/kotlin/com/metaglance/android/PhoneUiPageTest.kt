package com.metaglance.android

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.metaglance.android.support.MockDeviceKitTestCase
import com.metaglance.android.support.TestClips
import com.metaglance.android.support.TrafficRecorder
import com.metaglance.android.support.WebPage
import com.metaglance.android.support.requireFakeServer
import com.metaglance.android.support.waitFor
import com.metaglance.android.support.waitUntil
import com.metaglance.core.contract.CameraPermission
import com.metaglance.core.contract.DeviceToServer
import com.metaglance.core.contract.IntentKind
import com.metaglance.core.contract.IntentSource
import com.metaglance.core.contract.NativeState
import com.metaglance.core.contract.Network
import com.metaglance.core.contract.PageToNative
import com.metaglance.core.contract.Registration
import com.metaglance.core.contract.ServerEvent
import com.metaglance.core.contract.StreamStatus
import java.io.IOException
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The phone UI of `apps/mobile/ui` in the WebView of the app, with mock glasses and the fake server.
 * It reads the text that a person sees, and it clicks the buttons of the page.
 *
 * Each test is skipped for an APK that was built without the phone UI: run
 * `npm run build --workspace @glance/phone-ui` at the repository root, then build the APK again.
 * The setup test is also skipped for a phone UI that has no setup screen.
 */
@RunWith(AndroidJUnit4::class)
class PhoneUiPageTest : MockDeviceKitTestCase<MainActivity>(MainActivity::class.java) {
    private val traffic = TrafficRecorder()
    private val page = WebPage { scenarioRule.scenario }
    private var placeholderBefore = false

    private val native: NativeState get() = glance.session.nativeState.value

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
    fun thePageShowsEachSetupStepAndTheStartOpensTheSessionScreen() {
        assumeTrue("The phone UI of this APK has no setup screen.", uiHasSetupScreen())
        // MockDeviceKit starts again with no registration, as on a phone that never saw the glasses.
        onMain {
            glance.mockGlasses.enable(registered = false)
            glance.datLink.initialize(bluetoothGranted = false)
            assertTrue("The pairing failed.", glance.mockGlasses.pair())
        }
        waitUntil("the registration is unavailable", STEP_MS, ::state) { native.registration == Registration.UNAVAILABLE }

        // Step 1: link the glasses. A phone with no network gets the retry button in place of the link button.
        page.awaitVisibleText(SETUP_TITLE)
        val offline = native.network == Network.OFFLINE
        page.awaitVisibleText(if (offline) "No internet. Connect the phone, then try again." else "This opens the Meta AI app.")
        click(if (offline) "Try again" else LINK_STEP)
        waitUntil("the registration is registered", STEP_MS, ::state) { native.registration == Registration.REGISTERED }

        // Step 2: allow the camera. The shopper returns from Meta AI with a denied permission, and the page says so.
        onMain { glance.mockGlasses.setCameraPermission(granted = false) }
        scenarioRule.scenario.recreate()
        waitUntil("the camera permission is denied", STEP_MS, ::state) { native.cameraPermission == CameraPermission.DENIED }
        page.awaitVisibleText(SETUP_TITLE)
        page.awaitVisibleText("The camera permission was denied.")
        assertFalse("The page shows the start button before the camera is allowed.", hasButton(START))
        onMain { glance.mockGlasses.setCameraRequestResult(granted = true) }
        click(CAMERA_STEP)
        waitUntil("the camera permission is granted", STEP_MS, ::state) { native.cameraPermission == CameraPermission.GRANTED }

        // Step 3: start. The session screen replaces the setup screen.
        page.awaitVisibleText("Nod to add it.")
        setCameraFeed(TestClips.SCENE)
        click(START)
        waitUntil("the stream reaches streaming", START_MS, ::state) { native.stream == StreamStatus.STREAMING }
        page.awaitVisibleText(EMPTY_CART)
        assertFalse("The page still shows the setup screen.", SETUP_TITLE in page.visibleText())
        assertEquals("Error events: ${traffic.nativeErrors}", emptyList<String>(), traffic.nativeErrors.toList())
    }

    @Test
    fun thePageShowsTheProductCardAndAddPutsTheProductInTheCart() {
        pairGlasses()
        setCameraFeed(TestClips.SCENE)
        // A phone UI with a setup screen shows its last step here, because the mock glasses are registered.
        if (uiHasSetupScreen()) click(START) else onMain { glance.session.onPageMessage(PageToNative.SessionStart) }
        page.awaitVisibleText("Glance")
        page.awaitVisibleText(EMPTY_CART)

        val pending = waitFor("the product prompt arrives", PROMPT_MS, ::state) { traffic.event<ServerEvent.GlancePending>() }
        assertEquals(PRODUCT_ID, pending.product.id)
        // The card has the name, the pack size, the price, and both buttons, each on a line of its own.
        // The name alone is not enough: the caption of the spoken line holds it too.
        waitUntil("the page shows the product card", STEP_MS, { page.visibleText() }) {
            page.visibleText().lines().map { it.trim() }.containsAll(listOf(pending.product.name, "1 L", "1.89 EUR", "Add", "Skip"))
        }

        click("Add")
        waitUntil("the page sends a yes with the prompt ID", STEP_MS, ::state) {
            traffic.sent<DeviceToServer.Intent> { it.kind == IntentKind.YES && it.source == IntentSource.PHONE && it.promptId == pending.promptId } != null
        }
        waitFor("the cart gets the product", STEP_MS, ::state) { traffic.event<ServerEvent.CartUpdated> { it.cart.items.isNotEmpty() } }
        waitUntil("the cart of the page shows the product", STEP_MS, { page.visibleText() }) {
            val text = page.visibleText()
            EMPTY_CART !in text && pending.product.name in text && "Total" in text
        }
    }

    /**
     * Clicks the last button of the page with exactly this text, and waits for it first.
     * The last one, because a step of the setup list can have the text of the button below it.
     */
    private fun click(text: String) {
        waitUntil("the page has the button \"$text\"", STEP_MS, { page.visibleText() }) {
            page.js("(() => { const b = ${buttons(text)}.at(-1); if (b) b.click(); return !!b; })()") == "true"
        }
    }

    private fun hasButton(text: String): Boolean = page.js("${buttons(text)}.length > 0") == "true"

    private fun buttons(text: String) = "[...document.querySelectorAll('button')].filter((x) => !x.disabled && x.innerText.trim() === '$text')"

    private fun apkHoldsPhoneUi(): Boolean = try {
        targetContext.assets.open("$UI_ROOT/index.html").close()
        true
    } catch (_: IOException) {
        false
    }

    /** Reads the scripts of the phone UI in the APK. A build with a setup screen holds the title of that screen. */
    private fun uiHasSetupScreen(): Boolean {
        val assets = targetContext.assets
        return assets.list("$UI_ROOT/assets").orEmpty().filter { it.endsWith(".js") }.any { name ->
            assets.open("$UI_ROOT/assets/$name").bufferedReader().use { SETUP_TITLE in it.readText() }
        }
    }

    private fun state(): String = "native=$native ${traffic.summary()} dat=${datLog.takeLast(LOG_TAIL)} page=${page.visibleText().take(PAGE_CHARS)}"

    private companion object {
        const val UI_ROOT = "ui"
        const val PRODUCT_ID = "oat-drink-1l"
        const val SETUP_TITLE = "Set up Glance"
        const val LINK_STEP = "Link glasses"
        const val CAMERA_STEP = "Allow camera"
        const val START = "Start shopping"
        const val EMPTY_CART = "Your cart is empty."
        const val STEP_MS = 10_000L
        const val START_MS = 15_000L
        const val PROMPT_MS = 30_000L
        const val PAGE_CHARS = 400
        const val LOG_TAIL = 12
    }
}
