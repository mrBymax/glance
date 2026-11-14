package com.metaglance.android

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.metaglance.android.support.ShopSessionTestCase
import com.metaglance.android.support.waitFor
import com.metaglance.android.support.waitUntil
import com.metaglance.core.contract.DeviceToServer
import com.metaglance.core.contract.IntentKind
import com.metaglance.core.contract.IntentSource
import com.metaglance.core.contract.MainYes
import com.metaglance.core.contract.PageToNative
import com.metaglance.core.contract.ServerEvent
import com.metaglance.core.state.DatPermission
import kotlinx.coroutines.launch
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The speech results of the glasses as an input: the checks of Plan 2 Task 23 Step 4 with mock glasses.
 * `speech.simulateTranscription` of MockDeviceKit is a result of the glasses.
 *
 * The media volume of the test phone is 0, so no line plays, and no test reaches the mute time of a line.
 * `SpeechQueueTest` and `VoiceInputTest` of the core module check that rule.
 */
@RunWith(AndroidJUnit4::class)
class VoiceCommandsTest : ShopSessionTestCase() {
    @Test
    fun aSpokenAddAfterAPromptAddsTheProduct() {
        startSession()
        val pending = awaitFinishedProductPrompt()
        awaitSpeech()

        say("add")
        val sent = waitFor("speech.final goes out", STEP_MS, ::state) { traffic.sent<DeviceToServer.SpeechFinal>() }
        assertEquals("add", sent.text)
        assertEquals(SPOKEN_CONFIDENCE, sent.confidence, CONFIDENCE_DELTA)
        assertTrue("The locale is blank.", sent.locale.isNotBlank())
        awaitCartWith(pending.product.id)
        // The app maps no word to an intent. The server does.
        assertEquals(emptyList<Any>(), intents())
    }

    @Test
    fun aPartialResultSendsNothingAndASpokenSkipSkipsTheProduct() {
        startSession()
        val pending = awaitFinishedProductPrompt()
        awaitSpeech()

        say("add", isFinal = false)
        say("skip")
        waitFor("the server skips the product", STEP_MS, ::state) { traffic.event<ServerEvent.GlanceCleared> { it.promptId == pending.promptId } }
        assertEquals(listOf("skip"), spoken())
        assertNull("The cart got an item: ${state()}", traffic.event<ServerEvent.CartUpdated>())
    }

    /**
     * `Speech.transcriptions` is a `StateFlow`, and it gives a result that is equal to the one before it one time
     * only. Measured with MockDeviceKit of DAT 1.0.1: "total" two times in a row, with nothing between them, gave
     * one message. A part of a sentence before each final result makes each final result new.
     */
    @Test
    fun theSameCommandTwoTimesGivesTwoMessagesWhenAPartialResultComesBetween() {
        startSession()
        awaitSpeech()

        say("total")
        waitUntil("the first speech.final goes out", STEP_MS, ::state) { spoken().size == 1 }
        say("total", isFinal = false)
        say("total")
        waitUntil("the second speech.final goes out", STEP_MS, ::state) { spoken().size == 2 }
        assertEquals(listOf("total", "total"), spoken())
    }

    @Test
    fun theVoiceAsMainYesAsksForTheMicrophoneAndStartsSpeech() {
        pairGlasses()
        denyMicrophoneUntilTheNextRequest()
        startSession()
        waitUntil("Motion runs", STEP_MS, ::state) { native.capabilities.motion }
        assertFalse("Speech runs with no microphone permission.", native.capabilities.speech)

        selectMainYes(MainYes.VOICE)
        waitUntil("the microphone permission is granted", STEP_MS, ::state) { microphone() == DatPermission.GRANTED }
        awaitSpeech()
        waitUntil("the voice is the main yes", STEP_MS, ::state) { glance.profileStore.profile.mainYes == MainYes.VOICE }
        // The app selects the main yes again after the first frames, and the voice must stay.
        Thread.sleep(MAIN_YES_SETTLE_MS)
        assertEquals(MainYes.VOICE, glance.profileStore.profile.mainYes)
    }

    @Test
    fun theIntentAskGoesToTheServerAndAsksForTheMicrophone() {
        pairGlasses()
        denyMicrophoneUntilTheNextRequest()
        startSession()

        page(PageToNative.Intent(IntentKind.ASK))
        awaitIntent(IntentKind.ASK, IntentSource.PHONE, null)
        waitUntil("the microphone permission is granted", STEP_MS, ::state) { microphone() == DatPermission.GRANTED }
        awaitSpeech()
    }

    @Test
    fun aDeniedMicrophoneLeavesTheHeadAsTheMainYes() {
        pairGlasses()
        onMain { glance.mockGlasses.setMicrophonePermission(granted = false) }
        refreshPermissions()
        startSession()
        waitUntil("Motion runs", STEP_MS, ::state) { native.capabilities.motion }

        val answersBefore = deniedAnswers()
        page(PageToNative.ProfileSet(mainYesPatch(MainYes.VOICE)))
        waitUntil("the request for the microphone gets its denied answer", STEP_MS, ::state) { deniedAnswers() > answersBefore }
        Thread.sleep(MAIN_YES_SETTLE_MS)
        assertFalse(native.capabilities.speech)
        assertEquals(MainYes.HEAD, glance.profileStore.profile.mainYes)
        assertEquals(MainYes.VOICE, glance.profileStore.wantedMainYes)
        assertTrue("Error events: ${traffic.nativeErrors}", traffic.nativeErrors.isEmpty())
    }

    /** The glasses have no microphone permission, and the next request of the app for it is allowed. */
    private fun denyMicrophoneUntilTheNextRequest() {
        onMain { glance.mockGlasses.setMicrophonePermission(granted = false, nextRequestGranted = true) }
        refreshPermissions()
    }

    /** The SDK reports a permission only when the app asks for it. */
    private fun refreshPermissions() {
        onMain { glance.scope.launch { glance.datLink.refreshPermissions() } }
        waitUntil("the microphone permission is denied", STEP_MS, ::state) { microphone() == DatPermission.DENIED }
    }

    private fun deniedAnswers(): Int = datLog.count { it == "microphone permission DENIED" }

    private fun microphone(): DatPermission = glance.datLink.snapshot.value.microphonePermission

    private fun say(text: String, isFinal: Boolean = true) = assertTrue("No mock glasses.", onMain { glance.mockGlasses.say(text, isFinal) })

    private fun spoken(): List<String> = traffic.toServer.filterIsInstance<DeviceToServer.SpeechFinal>().map { it.text }

    private fun awaitSpeech() = waitUntil("Speech runs", STEP_MS, ::state) { native.capabilities.speech }

    private companion object {
        /** The confidence of `MockGlassesController.say`. */
        const val SPOKEN_CONFIDENCE = 0.9
        const val CONFIDENCE_DELTA = 0.001

        /** The app selects the main yes 5 seconds after the first frame of the stream. */
        const val MAIN_YES_SETTLE_MS = 6_000L
    }
}
