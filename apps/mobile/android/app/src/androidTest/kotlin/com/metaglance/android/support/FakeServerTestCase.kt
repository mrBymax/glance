package com.metaglance.android.support

import androidx.test.platform.app.InstrumentationRegistry
import com.metaglance.android.MainActivity
import com.metaglance.core.contract.GlanceJson
import com.metaglance.core.contract.NativeState
import com.metaglance.core.contract.PageToNative
import com.metaglance.core.contract.SessionStatus
import com.metaglance.core.contract.StreamStatus
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.serializer
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Before

/**
 * The base class of a test that needs a message which the server of `apps/server` cannot send on request.
 * The server here is the fake server of the app, `tools/fake-server`: the test runs one of its keyboard commands
 * through HTTP, and it reads the log of that server.
 *
 * `scripts/integration/android/run-spine.mjs` starts the fake server and gives its address in the instrumentation
 * argument `fakeServerUrl`. Without that argument each test is skipped. The fake server sends no product prompt
 * by itself in such a run, so each message after "Camera on" is the answer to a command.
 */
abstract class FakeServerTestCase : MockDeviceKitTestCase<MainActivity>(MainActivity::class.java) {
    protected val traffic = TrafficRecorder()
    private val http = OkHttpClient()
    private var serverUrl: String? = null
    private var serverUrlBefore = ""

    protected val native: NativeState get() = glance.session.nativeState.value

    @Before
    override fun setUp() {
        val url = InstrumentationRegistry.getArguments().getString(ARG_FAKE_SERVER_URL)
        assumeTrue("The run has no fake server of the app: the argument $ARG_FAKE_SERVER_URL is missing.", url != null)
        super.setUp()
        serverUrl = url
        serverUrlBefore = glance.profileStore.serverUrl
        onMain {
            glance.session.onPageMessage(PageToNative.DataDelete)
            glance.profileStore.serverUrl = checkNotNull(url)
            glance.session.tap = traffic
        }
    }

    @After
    override fun tearDown() {
        // A skipped test did not run `setUp` to its end.
        if (serverUrl == null) return
        onMain {
            glance.session.onPageMessage(PageToNative.DataDelete)
            glance.session.tap = null
            glance.profileStore.serverUrl = serverUrlBefore
        }
        super.tearDown()
    }

    protected fun page(message: PageToNative) = onMain { glance.session.onPageMessage(message) }

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

    /** Runs one keyboard command of the fake server, for example `bio`. */
    protected fun command(name: String) {
        val request = Request.Builder().url("$serverUrl/debug/command/$name").post(ByteArray(0).toRequestBody()).build()
        http.newCall(request).execute().use { assertEquals("The fake server has no command $name.", NO_CONTENT, it.code) }
    }

    /** The newest log lines of the fake server. */
    protected fun serverLog(): List<String> = http.newCall(Request.Builder().url("$serverUrl/debug/log").build()).execute().use { response ->
        assertTrue("GET /debug/log gave the status ${response.code}.", response.isSuccessful)
        GlanceJson.decodeFromString(ListSerializer(String.serializer()), response.body?.string().orEmpty())
    }

    protected fun awaitServerLog(what: String, match: (String) -> Boolean) {
        waitUntil("the fake server logs $what", STEP_MS, { serverLog().takeLast(LOG_TAIL).toString() }) { serverLog().any(match) }
    }

    protected fun state(): String = "native=$native ${traffic.summary()} dat=${datLog.takeLast(LOG_TAIL)}"

    protected companion object {
        const val ARG_FAKE_SERVER_URL = "fakeServerUrl"
        const val START_MS = 15_000L
        const val STEP_MS = 10_000L
        const val LOG_TAIL = 12
        const val NO_CONTENT = 204
    }
}
