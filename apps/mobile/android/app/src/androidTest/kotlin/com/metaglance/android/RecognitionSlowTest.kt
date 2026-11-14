package com.metaglance.android

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.metaglance.android.support.FakeServerTestCase
import com.metaglance.android.support.WebPage
import com.metaglance.android.support.waitFor
import com.metaglance.android.support.waitUntil
import com.metaglance.core.contract.ServerEvent
import com.metaglance.core.contract.ServerToDevice
import com.metaglance.core.contract.SessionStatus
import com.metaglance.core.contract.StreamStatus
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The state "Recognition slow" of spec section 6.6: row 17 of the table of Plan 2 Task 17 Step 2. The state comes
 * from the server: an `error` event with the code `recognition.slow`, and the line "Recognition is slow right now."
 *
 * The server of `apps/server` reports it after 3 failed recognition calls in a row. With fake recognition it makes
 * no recognition call, so it never reports the state. The fake server of the app sends the same two messages for
 * its command `slow`. `DeviceStatesTest` has the other state of row 17, the failed payment.
 */
@RunWith(AndroidJUnit4::class)
class RecognitionSlowTest : FakeServerTestCase() {
    private val webPage = WebPage { scenarioRule.scenario }
    private var placeholderBefore: Boolean? = null

    @Before
    override fun setUp() {
        super.setUp()
        placeholderBefore = glance.profileStore.usePlaceholder
        onMain { glance.profileStore.usePlaceholder = true }
        // The activity reads the page selection when it builds its WebView. The placeholder page shows each message.
        scenarioRule.scenario.recreate()
        webPage.awaitText("state", "\"registration\"")
    }

    @After
    override fun tearDown() {
        placeholderBefore?.let { before -> onMain { glance.profileStore.usePlaceholder = before } }
        super.tearDown()
    }

    @Test
    fun slowRecognitionReachesThePageAndTheCameraStaysOn() {
        startSession()
        command("slow")

        val error = waitFor("the error event arrives", STEP_MS, ::state) { traffic.event<ServerEvent.Error>() }
        assertEquals(ServerEvent.Error(SLOW_CODE, SLOW_LINE), error)
        val line = waitFor("the line arrives", STEP_MS, ::state) {
            traffic.fromServer.filterIsInstance<ServerToDevice.Speak>().firstOrNull { it.text == SLOW_LINE }
        }
        assertNull("The line is a prompt.", line.promptId)
        webPage.awaitText("log", "< {\"t\":\"event\",\"event\":{\"type\":\"error\",\"code\":\"$SLOW_CODE\"")

        // The recovery is automatic: the app shows no error of its own, and the frames go on.
        val framesBefore = traffic.frames.size
        waitUntil("frames go out after the event", STEP_MS, ::state) { traffic.frames.size > framesBefore }
        assertEquals(SessionStatus.STARTED, native.session)
        assertEquals(StreamStatus.STREAMING, native.stream)
        assertEquals("Error events of the app: ${traffic.nativeErrors}", emptyList<String>(), traffic.nativeErrors.toList())
    }

    private companion object {
        const val SLOW_CODE = "recognition.slow"
        const val SLOW_LINE = "Recognition is slow right now."
    }
}
