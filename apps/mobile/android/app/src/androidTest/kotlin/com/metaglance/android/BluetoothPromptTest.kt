package com.metaglance.android

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import com.metaglance.android.support.TrafficRecorder
import com.metaglance.android.support.onMainSync
import com.metaglance.android.support.requireSilentPhone
import com.metaglance.android.support.waitUntil
import com.metaglance.core.contract.PageToNative
import com.metaglance.core.contract.Registration
import com.metaglance.core.state.NativeErrors
import java.util.regex.Pattern
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The Bluetooth prompt of Android at the start of "Glance": rows 1 and 2 of Plan 2 Task 16 Step 2, Review Focus 4.
 * The test denies each prompt, so the app never starts the real SDK. MockDeviceKit stays off.
 *
 * Android shows the prompt two times at most, and then it denies with no prompt. The test accepts both cases,
 * and at its end it clears the flags of the permission, so the next install asks again.
 */
@RunWith(AndroidJUnit4::class)
class BluetoothPromptTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val device = UiDevice.getInstance(instrumentation)
    private val traffic = TrafficRecorder()
    private lateinit var targetContext: Context
    private var scenario: ActivityScenario<MainActivity>? = null

    private val glance: GlanceApp get() = targetContext.applicationContext as GlanceApp

    @Before
    fun setUp() {
        targetContext = instrumentation.targetContext
        requireSilentPhone(targetContext)
        val granted = ContextCompat.checkSelfPermission(targetContext, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
        assumeTrue("The app holds the Bluetooth permission, so Android shows no prompt.", !granted)
        onMainSync {
            glance.askBluetoothAtStart = true
            glance.bluetoothAsked = false
            glance.session.tap = traffic
        }
    }

    @After
    fun tearDown() {
        // A prompt that a failed test left open must not stay on the screen.
        denyPromptIfShown(SHORT_MS)
        onMainSync {
            glance.askBluetoothAtStart = false
            glance.session.tap = null
        }
        scenario?.close()
        instrumentation.uiAutomation
            .executeShellCommand("pm clear-permission-flags ${targetContext.packageName} ${Manifest.permission.BLUETOOTH_CONNECT} user-set user-fixed")
            .close()
    }

    @Test
    fun aDeniedPromptDoesNotStopTheAppAndSetupRegisterAsksAgain() {
        val launched = ActivityScenario.launch(MainActivity::class.java).also { scenario = it }
        val shownAtStart = denyPromptIfShown(PROMPT_MS)
        waitUntil("the activity is in the foreground again", STEP_MS) { launched.state == Lifecycle.State.RESUMED }
        assertEquals(Registration.UNAVAILABLE, glance.session.nativeState.value.registration)
        assertFalse("The SDK runs with no Bluetooth permission.", glance.datLink.ready)

        // Android shows the prompt a second time, or it denies at once. Both ways the page gets the cause.
        var prompts = if (shownAtStart) 1 else 0
        for (attempt in 1..REGISTER_ATTEMPTS) {
            onMainSync { glance.session.onPageMessage(PageToNative.SetupRegister) }
            if (denyPromptIfShown(PROMPT_MS)) prompts += 1
            waitUntil("the error event of attempt $attempt", STEP_MS, { "errors=${traffic.nativeErrors}" }) {
                traffic.nativeErrors.count { it == NativeErrors.BLUETOOTH_DENIED.code } == attempt
            }
        }
        assertEquals(Registration.UNAVAILABLE, glance.session.nativeState.value.registration)
        assertFalse("The SDK runs with no Bluetooth permission.", glance.datLink.ready)
        // The number is in the test output, for the report of the run.
        println("BluetoothPromptTest: Android showed the prompt $prompts times.")
    }

    /** Taps the deny button of the permission prompt of Android. Returns false if no prompt shows in `timeoutMs`. */
    private fun denyPromptIfShown(timeoutMs: Long): Boolean {
        val deny = By.res(DENY_BUTTON)
        if (!device.wait(Until.hasObject(deny), timeoutMs)) return false
        device.findObject(deny)?.click()
        device.wait(Until.gone(deny), STEP_MS)
        return true
    }

    private companion object {
        /** The deny button of the prompt. Its ID has no text, so the language of the phone does not change it. */
        val DENY_BUTTON: Pattern = Pattern.compile(".*:id/permission_deny.*button")
        const val PROMPT_MS = 4_000L
        const val SHORT_MS = 500L
        const val STEP_MS = 10_000L
        const val REGISTER_ATTEMPTS = 2
    }
}
