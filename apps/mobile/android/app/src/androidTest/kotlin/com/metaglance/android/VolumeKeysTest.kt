package com.metaglance.android

import android.media.AudioManager
import android.os.SystemClock
import android.view.KeyEvent
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.metaglance.android.support.ShopSessionTestCase
import com.metaglance.android.support.waitFor
import com.metaglance.core.contract.IntentKind
import com.metaglance.core.contract.IntentSource
import com.metaglance.core.contract.MainYes
import com.metaglance.core.contract.PageToNative
import com.metaglance.core.contract.ServerEvent
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The volume keys as the yes and the no: the checks of Plan 2 Task 21 Step 4 with mock glasses.
 *
 * A key that the app takes as an answer goes through the input system of Android, as a press of the real key
 * does. A key that the app must leave to Android would change the media volume of the test phone. So for that
 * case the test calls `MainActivity.onKeyDown` and reads the result: false means that Android handles the key.
 */
@RunWith(AndroidJUnit4::class)
class VolumeKeysTest : ShopSessionTestCase() {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()

    @After
    override fun tearDown() {
        page(PageToNative.PocketSet(on = false))
        // A key that the app did not take raised the volume. The phone must be silent for the next test.
        val audio = targetContext.getSystemService(AudioManager::class.java)
        if (audio.getStreamVolume(AudioManager.STREAM_MUSIC) != 0) audio.setStreamVolume(AudioManager.STREAM_MUSIC, 0, 0)
        super.tearDown()
    }

    @Test
    fun volumeUpIsAYesForTheCurrentPromptAndTheVolumeStays() {
        selectMainYes(MainYes.KEY)
        startSession()
        val pending = awaitFinishedProductPrompt()

        instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_VOLUME_UP)
        awaitIntent(IntentKind.YES, IntentSource.KEY, pending.promptId)
        awaitCartWith(pending.product.id)
        assertEquals("The media volume changed.", 0, mediaVolume())

        // The add ended the prompt. With no current prompt, the key belongs to Android again.
        waitFor("the prompt ends", STEP_MS, ::state) { traffic.event<ServerEvent.GlanceCleared> { it.promptId == pending.promptId } }
        assertFalse("The app took a volume key with no current prompt.", keyDown(KeyEvent.KEYCODE_VOLUME_UP))
        assertFalse(keyUp(KeyEvent.KEYCODE_VOLUME_UP))
        assertEquals(1, intents().size)
    }

    @Test
    fun volumeDownIsANoForTheCurrentPrompt() {
        selectMainYes(MainYes.KEY)
        startSession()
        val pending = awaitFinishedProductPrompt()

        instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_VOLUME_DOWN)
        awaitIntent(IntentKind.NO, IntentSource.KEY, pending.promptId)
        waitFor("the server skips the product", STEP_MS, ::state) { traffic.event<ServerEvent.GlanceCleared> { it.promptId == pending.promptId } }
        assertEquals("The media volume changed.", 0, mediaVolume())
        assertTrue("The cart got an item: ${state()}", traffic.event<ServerEvent.CartUpdated>() == null)
        assertEquals(1, intents().size)
    }

    @Test
    fun aKeyThatStaysDownInPocketModeSendsOneYes() {
        selectMainYes(MainYes.KEY)
        startSession()
        page(PageToNative.PocketSet(on = true))
        val pending = awaitFinishedProductPrompt()

        val downAt = SystemClock.uptimeMillis()
        val down = KeyEvent(downAt, downAt, KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_VOLUME_UP, 0)
        instrumentation.sendKeySync(down)
        instrumentation.sendKeySync(KeyEvent.changeTimeRepeat(down, SystemClock.uptimeMillis(), 1))
        instrumentation.sendKeySync(KeyEvent.changeTimeRepeat(down, SystemClock.uptimeMillis(), 2))
        instrumentation.sendKeySync(KeyEvent(downAt, SystemClock.uptimeMillis(), KeyEvent.ACTION_UP, KeyEvent.KEYCODE_VOLUME_UP, 0))

        awaitIntent(IntentKind.YES, IntentSource.KEY, pending.promptId)
        awaitCartWith(pending.product.id)
        assertEquals("The media volume changed.", 0, mediaVolume())
        assertEquals("The repeat events sent an answer.", 1, intents().size)
    }

    @Test
    fun theKeysBelongToAndroidWithAnotherMainYesAndBeforeAPrompt() {
        selectMainYes(MainYes.KEY)
        startSession()
        // No prompt is current yet: the product comes into view 8 seconds after the start.
        assertFalse("The app took a volume key before the first prompt.", keyDown(KeyEvent.KEYCODE_VOLUME_UP))
        assertFalse(keyUp(KeyEvent.KEYCODE_VOLUME_UP))

        selectMainYes(MainYes.HEAD)
        awaitFinishedProductPrompt()
        assertFalse("The app took volume up while the head is the main yes.", keyDown(KeyEvent.KEYCODE_VOLUME_UP))
        assertFalse(keyUp(KeyEvent.KEYCODE_VOLUME_UP))
        assertFalse("The app took volume down while the head is the main yes.", keyDown(KeyEvent.KEYCODE_VOLUME_DOWN))
        assertFalse(keyUp(KeyEvent.KEYCODE_VOLUME_DOWN))
        assertEquals(emptyList<Any>(), intents())
    }

    private fun keyDown(keyCode: Int): Boolean = onActivity { it.onKeyDown(keyCode, KeyEvent(KeyEvent.ACTION_DOWN, keyCode)) }

    private fun keyUp(keyCode: Int): Boolean = onActivity { it.onKeyUp(keyCode, KeyEvent(KeyEvent.ACTION_UP, keyCode)) }

    private fun onActivity(read: (MainActivity) -> Boolean): Boolean {
        var result = false
        scenarioRule.scenario.onActivity { result = read(it) }
        return result
    }

    private fun mediaVolume(): Int = targetContext.getSystemService(AudioManager::class.java).getStreamVolume(AudioManager.STREAM_MUSIC)
}
