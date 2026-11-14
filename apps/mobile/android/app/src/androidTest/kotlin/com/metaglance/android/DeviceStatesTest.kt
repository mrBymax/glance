package com.metaglance.android

import android.net.ConnectivityManager
import android.net.Uri
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.meta.wearable.dat.core.types.ThermalLevel
import com.metaglance.android.support.MockDeviceKitTestCase
import com.metaglance.android.support.TestClips
import com.metaglance.android.support.TrafficRecorder
import com.metaglance.android.support.requireFakeServer
import com.metaglance.android.support.waitFor
import com.metaglance.android.support.waitUntil
import com.metaglance.core.contract.DeviceState
import com.metaglance.core.contract.DeviceToServer
import com.metaglance.core.contract.GlanceJson
import com.metaglance.core.contract.IntentKind
import com.metaglance.core.contract.IntentSource
import com.metaglance.core.contract.Link
import com.metaglance.core.contract.NativeState
import com.metaglance.core.contract.Network
import com.metaglance.core.contract.PageToNative
import com.metaglance.core.contract.Phase
import com.metaglance.core.contract.ServerEvent
import com.metaglance.core.contract.ServerToDevice
import com.metaglance.core.contract.SessionSnapshot
import com.metaglance.core.contract.SessionStatus
import com.metaglance.core.contract.StreamStatus
import com.metaglance.core.net.GlanceApi
import com.metaglance.core.state.DatCompatibility
import com.metaglance.core.state.DatFault
import com.metaglance.core.state.NativeErrors
import java.io.File
import okhttp3.OkHttpClient
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The device and error states of spec section 6.6 with mock glasses: the table of Plan 2 Task 17 Step 2.
 * Each test reaches one state with a call of MockDeviceKit or with a debug hook of the app. It reads
 * `NativeState`, the `error` events of the app, and the `device.state` messages that go to the server.
 *
 * The tests need the server of `apps/server` with fake recognition and fake speech at `BuildConfig.SERVER_URL`.
 * Rows 2 to 4 of the table are in `SetupFlowTest`. Row 9 is also in `SpineTest`.
 *
 * Row 17 has the two states that come from the server. The failed payment is here. It needs a kiosk that declines
 * each payment, and a clip with the code of that kiosk: `scripts/integration/android/run-spine.mjs` makes both for
 * each run. The server has no rule yet that reports slow recognition, so no test reaches that state.
 */
@RunWith(AndroidJUnit4::class)
class DeviceStatesTest : MockDeviceKitTestCase<MainActivity>(MainActivity::class.java) {
    private val traffic = TrafficRecorder()

    private val native: NativeState get() = glance.session.nativeState.value

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
            glance.session.onPageMessage(PageToNative.DataDelete)
            glance.session.tap = null
        }
        super.tearDown()
    }

    @Test
    fun row1AMissingMetaAiAppIsInTheState() {
        assertTrue(native.metaAiInstalled)
        onMain { glance.datLink.debugOverride(metaAiInstalled = false) }
        waitUntil("metaAiInstalled is false", STEP_MS, ::state) { !native.metaAiInstalled }
    }

    @Test
    fun row5GlassesThatAreOffGiveNoDevice() {
        pairGlasses()
        onMain { glasses.powerOff() }
        waitUntil("the device is gone or disconnected", STEP_MS, ::state) { native.device.let { it == null || it.link == Link.DISCONNECTED } }
        page(PageToNative.SessionStart)
        awaitError(NativeErrors.NO_DEVICE.code)
        assertEquals("A DAT session started.", 0, datSessionStarts())
    }

    @Test
    fun row6ARequiredUpdateIsInTheState() {
        pairGlasses()
        assertEquals(false, native.device?.updateRequired)
        onMain { glance.datLink.debugOverride(compatibility = DatCompatibility.DEVICE_UPDATE_REQUIRED) }
        waitUntil("updateRequired is true", STEP_MS, ::state) { native.device?.updateRequired == true }
    }

    @Test
    fun row7ATapPausesTheStreamAndATapResumesIt() {
        startSession()
        onMain { glasses.services.captouch.tap() }
        waitUntil("the session or the stream is paused", STEP_MS, ::state) {
            native.session == SessionStatus.PAUSED || native.stream == StreamStatus.PAUSED
        }
        waitUntil("device.state with paused goes out", STEP_MS, ::state) { sentState { it.stream == StreamStatus.PAUSED } }
        assertNoFrames("while the stream is paused")
        assertEquals("A new DAT session started.", 1, datSessionStarts())

        onMain { glasses.services.captouch.tap() }
        waitUntil("the stream is streaming again", STEP_MS, ::state) { native.stream == StreamStatus.STREAMING }
        awaitNewFrames("after the second tap")
        assertEquals("A new DAT session started.", 1, datSessionStarts())
        assertTrue("Error events: ${traffic.nativeErrors}", traffic.nativeErrors.isEmpty())
    }

    @Test
    fun row8ATapAndHoldStopsTheSessionAndOnlyTheShopperStartsANewOne() {
        startSession()
        onMain { glasses.services.captouch.tapAndHold() }
        waitUntil("the session is stopped", STEP_MS, ::state) { native.session == SessionStatus.STOPPED }
        awaitError(NativeErrors.STOPPED_BY_DEVICE.code)
        Thread.sleep(NO_RESTART_MS)
        assertEquals("A new DAT session started by itself.", 1, datSessionStarts())

        page(PageToNative.SessionStart)
        waitUntil("a new stream starts", START_MS, ::state) { native.stream == StreamStatus.STREAMING }
        assertEquals(2, datSessionStarts())
    }

    @Test
    fun row9AFoldStopsTheSessionAndAnUnfoldStartsANewOne() {
        startSession()
        val serverSession = glance.profileStore.serverSession?.sessionId
        onMain { glasses.fold() }
        awaitError(NativeErrors.HINGE_CLOSED.code)
        waitUntil("hingeOpen is false", STEP_MS, ::state) { native.device?.hingeOpen == false }
        onMain {
            glasses.unfold()
            glasses.don()
        }
        waitUntil("a new stream starts by itself", START_MS, ::state) { native.stream == StreamStatus.STREAMING && datSessionStarts() == 2 }
        assertEquals("The server session changed.", serverSession, glance.profileStore.serverSession?.sessionId)
    }

    @Test
    fun row10ALostLinkStopsTheSessionAndTheReturnStartsANewOne() {
        startSession()
        onMain { glasses.powerOff() }
        awaitError(NativeErrors.LINK_LOST.code)
        onMain {
            glasses.powerOn()
            glasses.unfold()
            glasses.don()
        }
        waitUntil("a new stream starts by itself", START_MS, ::state) { native.stream == StreamStatus.STREAMING && datSessionStarts() == 2 }
    }

    @Test
    fun row11GlassesOffTheFaceSendNoFrame() {
        startSession()
        onMain { glasses.doff() }
        waitUntil("worn is false", STEP_MS, ::state) { native.device?.worn == false }
        waitUntil("device.state with worn false goes out", STEP_MS, ::state) { sentState { it.worn == false } }
        assertNoFrames("while the glasses are off the face")

        onMain { glasses.don() }
        waitUntil("worn is true", STEP_MS, ::state) { native.device?.worn == true }
        awaitNewFrames("after the glasses are on the face again")
    }

    @Test
    fun row12AStartOffTheFaceGivesAnErrorAndNoSession() {
        pairGlasses()
        onMain { glasses.doff() }
        waitUntil("worn is false", STEP_MS, ::state) { native.device?.worn == false }
        page(PageToNative.SessionStart)
        awaitError(NativeErrors.NOT_WORN.code)
        assertEquals("A DAT session started.", 0, datSessionStarts())
        assertNull("The app made a server session.", glance.profileStore.serverSession)
    }

    @Test
    fun rows13And14TheBatteryLevelGoesToTheServerAndALowBatteryStopsTheSession() {
        startSession()
        for (level in listOf(20, 10)) {
            onMain { glasses.setBatteryLevel(level) }
            waitUntil("the battery is $level", STEP_MS, ::state) { native.device?.battery == level }
            waitUntil("device.state with the battery $level goes out", STEP_MS, ::state) { sentState { it.battery == level } }
        }
        assertTrue("Error events: ${traffic.nativeErrors}", traffic.nativeErrors.isEmpty())

        onMain { glasses.setBatteryLevel(3) }
        waitUntil("the battery is 3", STEP_MS, ::state) { native.device?.battery == 3 }
        onMain { glance.datLink.debugFault(DatFault(DatFault.Area.STREAM, "BATTERY_LOW")) }
        waitUntil("the session is stopped", STEP_MS, ::state) { native.session == SessionStatus.STOPPED }
        awaitError(NativeErrors.BATTERY_LOW.code)
        waitUntil("device.state with the battery 3 and the stream stopped goes out", STEP_MS, ::state) {
            sentState { it.battery == 3 && it.stream == StreamStatus.STOPPED }
        }
        Thread.sleep(NO_RESTART_MS)
        assertEquals("A new DAT session started by itself.", 1, datSessionStarts())
    }

    @Test
    fun row15GlassesThatAreTooWarmStopTheSession() {
        startSession()
        onMain { glasses.setThermalLevel(ThermalLevel.CRITICAL) }
        waitUntil("the thermal level is 6", STEP_MS, ::state) { native.device?.thermal == THERMAL_CRITICAL }
        onMain { glance.datLink.debugFault(DatFault(DatFault.Area.STREAM, "THERMAL_HOT")) }
        waitUntil("the session is stopped", STEP_MS, ::state) { native.session == SessionStatus.STOPPED }
        awaitError(NativeErrors.TOO_WARM.code)
        waitUntil("device.state with the thermal level 6 goes out", STEP_MS, ::state) { sentState { it.thermal == THERMAL_CRITICAL } }
        Thread.sleep(NO_RESTART_MS)
        assertEquals("A new DAT session started by itself.", 1, datSessionStarts())
    }

    @Test
    fun row16ADroppedServerLinkGivesOfflineTheLineAndThenOnline() {
        // `network` is also offline while the phone has no network of its own, and the socket through USB does not
        // change that. On such a phone the test sees the drop in the frames, the line, and the messages only.
        val phoneOnline = targetContext.getSystemService(ConnectivityManager::class.java).activeNetwork != null
        val linkUp = if (phoneOnline) Network.ONLINE else Network.OFFLINE
        startSession()
        assertEquals(linkUp, native.network)
        val statesBefore = traffic.toServer.count { it is DeviceToServer.DeviceStateChanged }
        onMain { glance.session.debugDropSocket(DROP_MS) }
        waitUntil("the network is offline", STEP_MS, ::state) { native.network == Network.OFFLINE }
        assertNoFrames("while the server link is down")
        waitUntil("the app gives the line of the lost connection to the phone voice", STEP_MS, ::state) {
            traffic.localLines.any { it.startsWith("Connection lost.") }
        }
        waitUntil("device.state goes out again", DROP_MS + STEP_MS, ::state) {
            traffic.toServer.count { it is DeviceToServer.DeviceStateChanged } > statesBefore
        }
        assertEquals(linkUp, native.network)
        assertEquals(1, traffic.localLines.count { it.startsWith("Connection lost.") })
        assertEquals("A new DAT session started.", 1, datSessionStarts())
        awaitNewFrames("after the server link is back")
    }

    @Test
    fun row17AFailedPaymentReachesTheAppAndTheCartStays() {
        val arguments = InstrumentationRegistry.getArguments()
        val codeText = arguments.getString(ARG_FAIL_KIOSK_TEXT)
        val clipName = arguments.getString(ARG_FAIL_KIOSK_CLIP)
        assumeTrue("The run has no kiosk that declines the payment.", codeText != null && clipName != null)
        val clip = File(targetContext.cacheDir, checkNotNull(clipName))
        assertTrue("No clip at $clip.", clip.isFile)

        startSession()
        val pending = waitFor("the product prompt arrives", PROMPT_MS, ::state) { traffic.event<ServerEvent.GlancePending>() }
        waitUntil("Motion runs", STEP_MS, ::state) { native.capabilities.motion }
        playNod()
        waitUntil("the nod sends a yes for the product prompt", NOD_MS, ::state) { headYes(pending.promptId) }
        waitFor("the cart gets the product", STEP_MS, ::state) { traffic.event<ServerEvent.CartUpdated> { it.cart.items.isNotEmpty() } }

        // A running mock stream keeps its feed, so the code clip needs a new stream: a fold and an unfold.
        onMain {
            glasses.services.camera.setCameraFeed(Uri.fromFile(clip))
            glasses.fold()
        }
        awaitError(NativeErrors.HINGE_CLOSED.code)
        onMain {
            glasses.unfold()
            glasses.don()
        }
        waitUntil("kiosk.seen goes out with the code of the kiosk", KIOSK_MS, ::state) {
            traffic.sent<DeviceToServer.KioskSeen> { it.text == codeText } != null
        }
        val offered = waitFor("the pay prompt arrives", STEP_MS, ::state) { traffic.event<ServerEvent.CheckoutOffered>() }
        waitUntil("prompt.done goes out for the pay prompt", STEP_MS, ::state) {
            traffic.sent<DeviceToServer.PromptDone> { it.promptId == offered.promptId } != null
        }

        playNod()
        waitUntil("the nod sends a yes for the pay prompt", NOD_MS, ::state) { headYes(offered.promptId) }
        waitFor("the payment fails", PAY_MS, ::state) { traffic.event<ServerEvent.CheckoutFailed>() }
        waitUntil("the line of the failed payment arrives", STEP_MS, ::state) {
            traffic.fromServer.any { it is ServerToDevice.Speak && it.text.startsWith("Payment failed.") }
        }

        assertNull("The server reported a payment.", traffic.event<ServerEvent.CheckoutPaid>())
        val snapshot = serverSnapshot()
        assertEquals(listOf(pending.product.id), snapshot.cart.items.map { it.productId })
        assertEquals(Phase.SHOPPING, snapshot.phase)
        assertNull(snapshot.lastReceipt)
        // The shopper can look at the code again, so the camera stays on.
        assertEquals(StreamStatus.STREAMING, native.stream)
        assertEquals("The fold and the unfold gave one new DAT session.", 2, datSessionStarts())
    }

    /** Pairs the glasses, starts a session from the page message, and waits for the first frame at the server. */
    private fun startSession() {
        pairGlasses()
        setCameraFeed(TestClips.SCENE)
        page(PageToNative.SessionStart)
        waitUntil("the stream reaches streaming", START_MS, ::state) {
            native.session == SessionStatus.STARTED && native.stream == StreamStatus.STREAMING
        }
        waitUntil("a frame goes out", STEP_MS, ::state) { traffic.frames.isNotEmpty() }
    }

    private fun page(message: PageToNative) = onMain { glance.session.onPageMessage(message) }

    private fun awaitError(code: String) = waitUntil("the error event $code", STEP_MS, ::state) { code in traffic.nativeErrors }

    private fun headYes(promptId: String) = traffic.sent<DeviceToServer.Intent> {
        it.kind == IntentKind.YES && it.source == IntentSource.HEAD && it.promptId == promptId
    } != null

    private fun serverSnapshot(): SessionSnapshot {
        val stored = checkNotNull(glance.profileStore.serverSession) { "The app holds no server session." }
        val json = GlanceApi(OkHttpClient(), BuildConfig.SERVER_URL).snapshot(stored.sessionId, stored.token)
        return GlanceJson.decodeFromJsonElement(SessionSnapshot.serializer(), json)
    }

    private fun sentState(match: (DeviceState) -> Boolean): Boolean = traffic.sent<DeviceToServer.DeviceStateChanged> { match(it.state) } != null

    /** A frame that the pipeline took before the change can still go out, so the count starts after a short time. */
    private fun assertNoFrames(what: String) {
        Thread.sleep(SETTLE_MS)
        val before = traffic.frames.size
        Thread.sleep(QUIET_MS)
        assertEquals("Frames went out $what.", before, traffic.frames.size)
    }

    private fun awaitNewFrames(what: String) {
        val before = traffic.frames.size
        waitUntil("frames go out $what", STEP_MS, ::state) { traffic.frames.size > before }
    }

    /**
     * The number of DAT sessions that started in this test. `DatLink` logs each session state, and only a new
     * session reports `STARTING`: a session that resumes goes from `PAUSED` to `STARTED`.
     */
    private fun datSessionStarts(): Int = datLog.count { it == "session STARTING" }

    private fun state(): String = "native=$native ${traffic.summary()} dat=${datLog.takeLast(LOG_TAIL)}"

    private companion object {
        const val START_MS = 15_000L
        const val STEP_MS = 10_000L
        const val SETTLE_MS = 1_000L
        const val QUIET_MS = 2_000L

        /** The app waits 2 seconds before it starts a session by itself. */
        const val NO_RESTART_MS = 4_000L
        const val DROP_MS = 5_000L
        const val THERMAL_CRITICAL = 6
        const val LOG_TAIL = 12

        /** The script of the server shows the product 8 seconds after the socket opens. */
        const val PROMPT_MS = 20_000L
        const val NOD_MS = 8_000L

        /** A new stream starts first, and the dwell rule reports the code after 1.5 seconds in view. */
        const val KIOSK_MS = 25_000L
        const val PAY_MS = 10_000L

        /** The instrumentation arguments of the runner: the QR text of the kiosk, and its clip in the cache of the app. */
        const val ARG_FAIL_KIOSK_TEXT = "failKioskText"
        const val ARG_FAIL_KIOSK_CLIP = "failKioskClip"
    }
}
