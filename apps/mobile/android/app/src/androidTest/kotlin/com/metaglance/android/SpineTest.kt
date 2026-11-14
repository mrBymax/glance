package com.metaglance.android

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.metaglance.android.support.MockDeviceKitTestCase
import com.metaglance.android.support.TestClips
import com.metaglance.android.support.TrafficRecorder
import com.metaglance.android.support.requireFakeServer
import com.metaglance.android.support.waitFor
import com.metaglance.android.support.waitUntil
import com.metaglance.core.contract.DeviceToServer
import com.metaglance.core.contract.GlanceJson
import com.metaglance.core.contract.IntentKind
import com.metaglance.core.contract.IntentSource
import com.metaglance.core.contract.PageToNative
import com.metaglance.core.contract.Phase
import com.metaglance.core.contract.ServerEvent
import com.metaglance.core.contract.ServerToDevice
import com.metaglance.core.contract.SessionSnapshot
import com.metaglance.core.contract.SessionStatus
import com.metaglance.core.contract.StreamStatus
import com.metaglance.core.net.GlanceApi
import com.metaglance.core.state.DatSession
import com.metaglance.core.state.NativeErrors
import okhttp3.OkHttpClient
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The spine of the app with mock glasses and the fake server: one shop from the first frame to the payment.
 *
 * It needs the server of `apps/server` with fake recognition and fake speech at `BuildConfig.SERVER_URL`,
 * with the script `scripts/integration/android/spine-script.json`. `scripts/integration/android/run-spine.mjs`
 * starts that server and runs this test.
 */
@RunWith(AndroidJUnit4::class)
class SpineTest : MockDeviceKitTestCase<MainActivity>(MainActivity::class.java) {
    private val http = OkHttpClient()
    private val traffic = TrafficRecorder()

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

    @Test
    fun aNodAddsTheProductAndANodAtTheKioskCodePays() {
        pairGlasses()
        setCameraFeed(TestClips.SCENE)
        onMain { glance.session.onPageMessage(PageToNative.SessionStart) }

        waitUntil("the stream reaches streaming", START_MS, ::state) {
            val native = glance.session.nativeState.value
            native.session == SessionStatus.STARTED && native.stream == StreamStatus.STREAMING
        }
        waitUntil("device.state with streaming goes out", STEP_MS, ::state) {
            traffic.sent<DeviceToServer.DeviceStateChanged> { it.state.stream == StreamStatus.STREAMING } != null
        }
        waitUntil("frames go out", STEP_MS, ::state) { traffic.frames.size >= 2 }
        val frame = traffic.frames.first()
        // Each upload is the full frame of the 720 x 1280 stream with a long side of 768 pixels, and face detection ran on it.
        assertEquals(UPLOAD_SIZE, frame.header.w to frame.header.h)
        assertTrue("An upload went out with no face detection.", traffic.frames.all { it.header.blurred })

        val pending = waitFor("the product prompt arrives", PROMPT_MS, ::state) { traffic.event<ServerEvent.GlancePending>() }
        assertEquals(PRODUCT_ID, pending.product.id)
        waitUntil("the line of the product prompt arrives", STEP_MS, ::state) { spoken(pending.promptId) }
        waitUntil("prompt.done goes out for the product prompt", STEP_MS, ::state) { promptDone(pending.promptId) }

        waitUntil("Motion runs", STEP_MS, ::state) { glance.session.nativeState.value.capabilities.motion }
        playNod()
        waitUntil("the nod sends a yes for the product prompt", NOD_MS, ::state) { headYes(pending.promptId) }
        val added = waitFor("the cart gets the product", STEP_MS, ::state) { traffic.event<ServerEvent.CartUpdated> { it.cart.items.isNotEmpty() } }
        assertEquals(listOf(PRODUCT_ID), added.cart.items.map { it.productId })

        val shopping = serverSnapshot()
        assertEquals(Phase.SHOPPING, shopping.phase)
        assertEquals(1, shopping.cart.items.size)
        assertEquals(PRODUCT_ID, shopping.cart.items.single().productId)
        assertEquals(1, shopping.cart.items.single().qty)

        showKioskCode()
        waitUntil("kiosk.seen goes out with the code text", KIOSK_MS, ::state) { traffic.sent<DeviceToServer.KioskSeen> { it.text == TestClips.KIOSK_TEXT } != null }
        val offered = waitFor("the pay prompt arrives", STEP_MS, ::state) { traffic.event<ServerEvent.CheckoutOffered>() }
        assertEquals(1, offered.itemCount)
        assertEquals(shopping.cart.totalCents, offered.totalCents)
        waitUntil("prompt.done goes out for the pay prompt", STEP_MS, ::state) { promptDone(offered.promptId) }

        playNod()
        waitUntil("the nod sends a yes for the pay prompt", NOD_MS, ::state) { headYes(offered.promptId) }
        val paid = waitFor("the payment ends", PAY_MS, ::state) { traffic.event<ServerEvent.CheckoutPaid>() }
        assertEquals(shopping.cart.totalCents, paid.totalCents)

        waitUntil("the server ends the session", STEP_MS, ::state) { traffic.fromServer.any { it is ServerToDevice.SessionEnd } }
        waitUntil("the DAT session stops", STEP_MS, ::state) {
            glance.datLink.snapshot.value.session == DatSession.STOPPED && glance.session.nativeState.value.stream == StreamStatus.STOPPED
        }
        val end = serverSnapshot()
        assertEquals(Phase.PAID, end.phase)
        assertNotNull(end.lastReceipt)

        // Rule R3: each answer carries the ID of its prompt, and the test saw no answer that the socket dropped.
        assertEquals(2, traffic.toServer.filterIsInstance<DeviceToServer.Intent>().size)
        assertTrue("Messages that the socket dropped: ${traffic.notSent}", traffic.notSent.isEmpty())
        assertEquals(listOf(NativeErrors.HINGE_CLOSED.code), traffic.nativeErrors.toList())

        // A start after the payment is a new shop: the app asks the server for a new session.
        val paidSessionId = end.sessionId
        onMain { glance.session.onPageMessage(PageToNative.SessionStart) }
        waitUntil("the app holds a new server session", START_MS, ::state) {
            glance.profileStore.serverSession.let { it != null && it.live && it.sessionId != paidSessionId }
        }
        waitUntil("the stream of the new session reaches streaming", START_MS, ::state) {
            glance.session.nativeState.value.stream == StreamStatus.STREAMING
        }
        assertEquals(Phase.SHOPPING, serverSnapshot().phase)
    }

    /**
     * A running mock stream keeps its feed, so the code clip needs a new stream. The shopper folds the glasses and
     * opens them again: the app then starts a new DAT session by itself, and the server session stays.
     */
    private fun showKioskCode() {
        val sessionId = glance.profileStore.serverSession?.sessionId
        setCameraFeed(TestClips.KIOSK)
        val framesBefore = traffic.frames.size
        onMain { glasses.fold() }
        waitUntil("the app reports the closed hinge", STEP_MS, ::state) { NativeErrors.HINGE_CLOSED.code in traffic.nativeErrors }
        assertEquals(DatSession.STOPPED, glance.datLink.snapshot.value.session)
        onMain {
            glasses.unfold()
            glasses.don()
        }
        waitUntil("a new stream starts after the unfold", START_MS, ::state) {
            glance.session.nativeState.value.stream == StreamStatus.STREAMING && traffic.frames.size > framesBefore
        }
        assertEquals("The server session changed.", sessionId, glance.profileStore.serverSession?.sessionId)
    }

    private fun spoken(promptId: String) = traffic.fromServer.any { it is ServerToDevice.Speak && it.promptId == promptId }

    private fun promptDone(promptId: String) = traffic.sent<DeviceToServer.PromptDone> { it.promptId == promptId } != null

    private fun headYes(promptId: String) = traffic.sent<DeviceToServer.Intent> {
        it.kind == IntentKind.YES && it.source == IntentSource.HEAD && it.promptId == promptId
    } != null

    private fun serverSnapshot(): SessionSnapshot {
        val stored = checkNotNull(glance.profileStore.serverSession) { "The app holds no server session." }
        val json = GlanceApi(http, BuildConfig.SERVER_URL).snapshot(stored.sessionId, stored.token)
        return GlanceJson.decodeFromJsonElement(SessionSnapshot.serializer(), json)
    }

    private fun state(): String = "native=${glance.session.nativeState.value} ${traffic.summary()} dat=${datLog.takeLast(LOG_TAIL)}"

    private companion object {
        const val PRODUCT_ID = "oat-drink-1l"
        val UPLOAD_SIZE = 432 to 768
        const val START_MS = 15_000L
        const val STEP_MS = 10_000L

        /** The script of the server shows the product 8 seconds after the socket opens. */
        const val PROMPT_MS = 20_000L
        const val NOD_MS = 8_000L

        /** The dwell rule reports the code after 1.5 seconds in view. */
        const val KIOSK_MS = 15_000L
        const val PAY_MS = 10_000L
        const val LOG_TAIL = 12
    }
}
