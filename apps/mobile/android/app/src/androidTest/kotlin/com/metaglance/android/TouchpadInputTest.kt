package com.metaglance.android

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.meta.wearable.dat.inputs.types.InputSource
import com.metaglance.android.support.ShopSessionTestCase
import com.metaglance.android.support.waitFor
import com.metaglance.android.support.waitUntil
import com.metaglance.core.contract.DeviceToServer
import com.metaglance.core.contract.IntentKind
import com.metaglance.core.contract.IntentSource
import com.metaglance.core.contract.ServerEvent
import com.metaglance.core.contract.ServerToDevice
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The touchpad of the glasses as an input: the checks of Plan 2 Task 22 Step 4 with mock glasses.
 * `input.select` of MockDeviceKit is the double tap, and `input.navDown` is a swipe.
 */
@RunWith(AndroidJUnit4::class)
class TouchpadInputTest : ShopSessionTestCase() {
    @Test
    fun aDoubleTapAfterAPromptAddsTheProduct() {
        startSession()
        val pending = awaitFinishedProductPrompt()
        awaitInputs()

        doubleTap()
        awaitIntent(IntentKind.YES, IntentSource.TOUCH, pending.promptId)
        awaitCartWith(pending.product.id)
        assertEquals(1, intents().size)
    }

    @Test
    fun aDoubleTapBeforeTheFirstPromptNamesNoPromptAndAddsNothing() {
        startSession()
        awaitInputs()

        doubleTap()
        awaitIntent(IntentKind.YES, IntentSource.TOUCH, null)
        // The product prompt comes later, and the early yes must not answer it.
        val pending = awaitFinishedProductPrompt()
        Thread.sleep(QUIET_MS)
        assertNull("The cart got an item: ${state()}", traffic.event<ServerEvent.CartUpdated>())
        assertNull(traffic.event<ServerEvent.GlanceCleared> { it.promptId == pending.promptId })
    }

    @Test
    fun aSwipeAsksForTheLastLineAgain() {
        startSession()
        val pending = awaitFinishedProductPrompt()
        awaitInputs()
        val promptLine = waitFor("the line of the product prompt arrives", STEP_MS, ::state) { lines().lastOrNull { it.promptId == pending.promptId } }
        val linesBefore = lines().size

        onMain { glasses.services.input.navDown(InputSource.CAPTOUCH) }
        awaitIntent(IntentKind.REPEAT, IntentSource.TOUCH, null)
        waitUntil("the server sends the line again", STEP_MS, ::state) { lines().size > linesBefore }
        val again = lines().last()
        assertEquals(promptLine.text, again.text)
        // The repeat of the line of a current prompt is that prompt again.
        assertEquals(pending.promptId, again.promptId)
        assertNull("The cart got an item: ${state()}", traffic.event<ServerEvent.CartUpdated>())
        assertEquals(listOf(DeviceToServer.Intent(IntentKind.REPEAT, IntentSource.TOUCH)), intents())
    }

    private fun doubleTap() = onMain { glasses.services.input.select(InputSource.CAPTOUCH) }

    private fun awaitInputs() = waitUntil("Inputs runs", STEP_MS, ::state) { native.capabilities.inputs }

    private fun lines(): List<ServerToDevice.Speak> = traffic.fromServer.filterIsInstance<ServerToDevice.Speak>()

    private companion object {
        const val QUIET_MS = 2_000L
    }
}
