package com.metaglance.android.support

import com.metaglance.android.BuildConfig
import com.metaglance.android.MainActivity
import com.metaglance.core.contract.DeviceToServer
import com.metaglance.core.contract.GlanceJson
import com.metaglance.core.contract.IntentKind
import com.metaglance.core.contract.IntentSource
import com.metaglance.core.contract.MainYes
import com.metaglance.core.contract.NativeState
import com.metaglance.core.contract.PageToNative
import com.metaglance.core.contract.ServerEvent
import com.metaglance.core.contract.SessionStatus
import com.metaglance.core.contract.StreamStatus
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.After
import org.junit.Before

/**
 * The base class of a test that answers a product prompt in a session with mock glasses.
 *
 * It needs the server of `apps/server` with fake recognition and fake speech at `BuildConfig.SERVER_URL`, with
 * the script `scripts/integration/android/spine-script.json`: one product is in view from second 8 to second 10
 * of each session. `scripts/integration/android/run-spine.mjs` starts that server.
 */
abstract class ShopSessionTestCase : MockDeviceKitTestCase<MainActivity>(MainActivity::class.java) {
    protected val traffic = TrafficRecorder()

    protected val native: NativeState get() = glance.session.nativeState.value

    @Before
    override fun setUp() {
        super.setUp()
        requireFakeServer(BuildConfig.SERVER_URL)
        onMain {
            glance.session.onPageMessage(PageToNative.DataDelete)
            glance.profileStore.serverUrl = BuildConfig.SERVER_URL
            glance.session.tap = traffic
        }
    }

    @After
    override fun tearDown() {
        onMain {
            // Stops the DAT session, removes the server session, and clears the stored profile.
            glance.session.onPageMessage(PageToNative.DataDelete)
            glance.session.tap = null
        }
        super.tearDown()
    }

    protected fun page(message: PageToNative) = onMain { glance.session.onPageMessage(message) }

    /** Sends the profile patch of the page that selects the main yes input. */
    protected fun selectMainYes(mainYes: MainYes) {
        val wire = GlanceJson.encodeToJsonElement(MainYes.serializer(), mainYes)
        page(PageToNative.ProfileSet(buildJsonObject { put("mainYes", wire) }))
        waitUntil("the profile has the main yes $mainYes", STEP_MS, ::state) { glance.profileStore.profile.mainYes == mainYes }
    }

    /** Pairs the glasses, starts a session from the page message, and waits for the first frame at the server. */
    protected fun startSession() {
        pairGlasses()
        setCameraFeed(TestClips.SCENE)
        page(PageToNative.SessionStart)
        waitUntil("the stream reaches streaming", START_MS, ::state) {
            native.session == SessionStatus.STARTED && native.stream == StreamStatus.STREAMING
        }
        waitUntil("a frame goes out", STEP_MS, ::state) { traffic.frames.isNotEmpty() }
    }

    /** Waits for the product prompt of the script, and until the app reported the end of its line. */
    protected fun awaitFinishedProductPrompt(): ServerEvent.GlancePending {
        val pending = waitFor("the product prompt arrives", PROMPT_MS, ::state) { traffic.event<ServerEvent.GlancePending>() }
        waitUntil("prompt.done goes out for the product prompt", STEP_MS, ::state) {
            traffic.sent<DeviceToServer.PromptDone> { it.promptId == pending.promptId } != null
        }
        return pending
    }

    protected fun intents(): List<DeviceToServer.Intent> = traffic.toServer.filterIsInstance<DeviceToServer.Intent>()

    protected fun awaitIntent(kind: IntentKind, source: IntentSource, promptId: String?) {
        val wanted = DeviceToServer.Intent(kind, source, promptId)
        waitUntil("the intent $wanted goes out", STEP_MS, ::state) { wanted in intents() }
    }

    protected fun awaitCartWith(productId: String) {
        waitFor("the cart gets the product", STEP_MS, ::state) {
            traffic.event<ServerEvent.CartUpdated> { update -> update.cart.items.any { it.productId == productId } }
        }
    }

    protected fun state(): String = "native=$native ${traffic.summary()} dat=${datLog.takeLast(LOG_TAIL)}"

    protected companion object {
        const val START_MS = 15_000L
        const val STEP_MS = 10_000L

        /** The script of the server shows the product 8 seconds after the socket opens. */
        const val PROMPT_MS = 20_000L
        const val LOG_TAIL = 12
    }
}
