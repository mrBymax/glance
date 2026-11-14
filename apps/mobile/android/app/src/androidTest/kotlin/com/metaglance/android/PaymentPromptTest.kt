package com.metaglance.android

import android.content.Context
import androidx.fragment.app.FragmentActivity
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import com.metaglance.android.support.FakeServerTestCase
import com.metaglance.android.support.waitUntil
import com.metaglance.core.contract.DeviceToServer
import com.metaglance.core.contract.ServerToDevice
import com.metaglance.core.input.PromptOutcome
import com.metaglance.core.state.NativeErrors
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The fingerprint before a payment: the checks of Plan 2 Task 24 Step 2 that need no finger. The command `bio` of
 * the fake server sends `biometric.request`, as a server with the setting BIOMETRIC_ABOVE_CENTS does before a
 * payment above that limit. A server with no such setting never sends it.
 *
 * Two tests show the real prompt of Android and close it with no finger: one with the back key, as a shopper
 * who cancels, and one with the end of the checkout. The other tests replace the prompt, so that a test can
 * report a finger that matches, a finger that does not match, and a phone with no screen lock.
 */
@RunWith(AndroidJUnit4::class)
class PaymentPromptTest : FakeServerTestCase() {
    private val device: UiDevice = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
    private val fake = FakePrompt()
    private var promptBefore: PaymentPrompt? = null

    @Before
    override fun setUp() {
        super.setUp()
        promptBefore = glance.paymentPrompt
    }

    @After
    override fun tearDown() {
        promptBefore?.let { before ->
            onMain {
                glance.paymentPrompt.cancel()
                glance.paymentPrompt = before
            }
        }
        super.tearDown()
    }

    @Test
    fun theRealPromptShowsAndACancelSendsOkFalse() {
        assumeTrue("This phone has no screen lock and no biometric.", glance.paymentPrompt.available(targetContext))
        startSession()
        command("bio")
        assertNotNull("The prompt of Android did not show.", device.wait(Until.hasObject(By.text(BiometricPaymentPrompt.TITLE)), STEP_MS))
        assertTrue("The prompt has no subtitle.", device.hasObject(By.text(BiometricPaymentPrompt.SUBTITLE)))
        assertEquals("A result went out while the prompt was open.", emptyList<Boolean>(), results())

        device.pressBack()
        waitUntil("biometric.result goes out", STEP_MS, ::state) { results().isNotEmpty() }
        assertEquals(listOf(false), results())
        awaitServerLog("the result") { it == "biometric.result ok=false" }
        assertTrue("The prompt is still on the screen.", device.wait(Until.gone(By.text(BiometricPaymentPrompt.TITLE)), STEP_MS))
        assertEquals("Error events of the app: ${traffic.nativeErrors}", emptyList<String>(), traffic.nativeErrors.toList())
    }

    @Test
    fun theRealPromptClosesWhenTheCheckoutEnds() {
        assumeTrue("This phone has no screen lock and no biometric.", glance.paymentPrompt.available(targetContext))
        startSession()
        command("bio")
        assertNotNull("The prompt of Android did not show.", device.wait(Until.hasObject(By.text(BiometricPaymentPrompt.TITLE)), STEP_MS))

        command("cancel")
        assertTrue("The prompt is still on the screen.", device.wait(Until.gone(By.text(BiometricPaymentPrompt.TITLE)), STEP_MS))
        waitUntil("biometric.result goes out", STEP_MS, ::state) { results().isNotEmpty() }
        assertEquals(listOf(false), results())
    }

    @Test
    fun aFingerThatMatchesSendsOkTrueOneTime() {
        useFakePrompt()
        startSession()
        command("bio")
        waitUntil("the app shows the prompt", STEP_MS, ::state) { fake.shows == 1 }

        // A finger that does not match leaves the prompt open, so no result goes out.
        onMain { fake.report(PromptOutcome.ATTEMPT_FAILED) }
        // A second request while the prompt is open shows no second prompt.
        command("bio")
        waitUntil("the second request arrives", STEP_MS, ::state) { traffic.fromServer.count { it is ServerToDevice.BiometricRequest } == 2 }
        onMain { fake.report(PromptOutcome.SUCCEEDED) }
        waitUntil("biometric.result goes out", STEP_MS, ::state) { results().isNotEmpty() }
        awaitServerLog("the result") { it == "biometric.result ok=true" }
        assertEquals(listOf(true), results())
        assertEquals(1, fake.shows)
    }

    @Test
    fun aPhoneWithNoScreenLockSendsOkFalseAndTheErrorEvent() {
        useFakePrompt()
        fake.available = false
        startSession()
        command("bio")
        waitUntil("biometric.result goes out", STEP_MS, ::state) { results().isNotEmpty() }
        waitUntil("the error event goes to the page", STEP_MS, ::state) { NativeErrors.BIOMETRIC_UNAVAILABLE.code in traffic.nativeErrors }
        assertEquals(listOf(false), results())
        assertEquals(0, fake.shows)
    }

    @Test
    fun theEndOfTheCheckoutClosesThePrompt() {
        useFakePrompt()
        startSession()
        command("bio")
        waitUntil("the app shows the prompt", STEP_MS, ::state) { fake.shows == 1 }
        command("cancel")
        waitUntil("the app closes the prompt", STEP_MS, ::state) { fake.cancels == 1 }
        waitUntil("biometric.result goes out", STEP_MS, ::state) { results().isNotEmpty() }
        assertEquals(listOf(false), results())
    }

    private fun useFakePrompt() = onMain { glance.paymentPrompt = fake }

    private fun results(): List<Boolean> = traffic.toServer.filterIsInstance<DeviceToServer.BiometricResult>().map { it.ok }

    /** Stands in for the prompt of Android. A test reports each outcome on the main thread. */
    private class FakePrompt : PaymentPrompt {
        @Volatile
        var available = true

        @Volatile
        var shows = 0

        @Volatile
        var cancels = 0
        private var onOutcome: ((PromptOutcome) -> Unit)? = null

        override fun available(context: Context): Boolean = available

        override fun show(activity: FragmentActivity, onOutcome: (PromptOutcome) -> Unit) {
            this.onOutcome = onOutcome
            shows += 1
        }

        /** As the prompt of Android: a cancel reports an error. */
        override fun cancel() {
            if (onOutcome == null) return
            cancels += 1
            report(PromptOutcome.ERROR)
        }

        fun report(outcome: PromptOutcome) {
            val receiver = checkNotNull(onOutcome) { "No prompt is open." }
            if (outcome != PromptOutcome.ATTEMPT_FAILED) onOutcome = null
            receiver(outcome)
        }
    }
}
