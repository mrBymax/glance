package com.metaglance.android

import android.content.Context
import android.view.WindowManager
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.test.ext.junit.rules.ActivityScenarioRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.metaglance.android.support.GlanceTestRunner
import com.metaglance.android.support.WebPage
import com.metaglance.android.support.onMainSync
import com.metaglance.android.support.requireSilentPhone
import com.metaglance.android.support.waitUntil
import com.metaglance.core.contract.HapticPattern
import com.metaglance.core.contract.PageToNative
import com.metaglance.core.state.HapticPatterns
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The haptic patterns and the native side of pocket mode: the checks of Plan 2 Task 19 Step 4 that need no hand.
 * The buttons of the placeholder page send the messages. The test runner takes each vibration in place of the
 * phone, so the phone stays quiet, and the test reads the timings that the app asked for.
 */
@RunWith(AndroidJUnit4::class)
class HapticsPocketTest {
    @get:Rule
    val scenarioRule = ActivityScenarioRule(MainActivity::class.java)

    private val page = WebPage { scenarioRule.scenario }
    private lateinit var targetContext: Context
    private var placeholderBefore = false

    private val glance: GlanceApp get() = targetContext.applicationContext as GlanceApp

    @Before
    fun setUp() {
        targetContext = InstrumentationRegistry.getInstrumentation().targetContext
        requireSilentPhone(targetContext)
        placeholderBefore = glance.profileStore.usePlaceholder
        onMainSync {
            glance.session.onPageMessage(PageToNative.DataDelete)
            glance.profileStore.usePlaceholder = true
        }
        // The activity reads the page selection when it builds its WebView.
        scenarioRule.scenario.recreate()
        page.awaitText("profile", "\"haptics\": true")
        GlanceTestRunner.vibrations.clear()
    }

    @After
    fun tearDown() {
        onMainSync {
            glance.session.onPageMessage(PageToNative.PocketSet(on = false))
            glance.session.onPageMessage(PageToNative.DataDelete)
            glance.profileStore.usePlaceholder = placeholderBefore
        }
    }

    @Test
    fun eachHapticButtonPlaysThePatternOfItsName() {
        for ((index, pattern) in HapticPattern.entries.withIndex()) {
            page.clickButton("haptic ${wireName(pattern)}")
            waitUntil("the vibration of $pattern", STEP_MS) { GlanceTestRunner.vibrations.size == index + 1 }
            assertEquals(HapticPatterns.timings(pattern).toList(), GlanceTestRunner.vibrations.last())
        }
        assertEquals(HapticPattern.entries.size, GlanceTestRunner.vibrations.toSet().size)
    }

    @Test
    fun noVibrationPlaysWithHapticsOffInTheProfile() {
        page.clickButton("profile.set haptics false")
        page.awaitText("profile", "\"haptics\": false")
        page.clickButton("haptic added")
        // The answer to a later message shows that the app handled the haptic message before it.
        page.clickButton("profile.set speechRate 1.5")
        page.awaitText("profile", "\"speechRate\": 1.5")
        assertEquals(emptyList<List<Long>>(), GlanceTestRunner.vibrations.toList())
    }

    @Test
    fun pocketModeDimsTheScreenAndHidesTheBars() {
        assertEquals(WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE, brightness(), 0f)
        page.clickButton("pocket.set on")
        waitUntil("the screen is dim", STEP_MS) { brightness() == POCKET_BRIGHTNESS }
        waitUntil("the system bars are hidden", STEP_MS) { !barsVisible() }

        page.clickButton("pocket.set off")
        waitUntil("the brightness follows the phone again", STEP_MS) { brightness() == WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE }
        waitUntil("the system bars show", STEP_MS) { barsVisible() }
    }

    private fun wireName(pattern: HapticPattern): String = when (pattern) {
        HapticPattern.PROMPT -> "prompt"
        HapticPattern.ADDED -> "added"
        HapticPattern.REMOVED -> "removed"
        HapticPattern.WARNING -> "warning"
        HapticPattern.PAID -> "paid"
        HapticPattern.ERROR -> "error"
        HapticPattern.CAMERA_PAUSED -> "cameraPaused"
        HapticPattern.CAMERA_OFF -> "cameraOff"
    }

    private fun <R> onWindow(read: (MainActivity) -> R): R {
        var result: R? = null
        scenarioRule.scenario.onActivity { result = read(it) }
        @Suppress("UNCHECKED_CAST")
        return result as R
    }

    private fun brightness(): Float = onWindow { it.window.attributes.screenBrightness }

    private fun barsVisible(): Boolean = onWindow { activity ->
        ViewCompat.getRootWindowInsets(activity.window.decorView)?.isVisible(WindowInsetsCompat.Type.statusBars()) ?: true
    }

    private companion object {
        const val STEP_MS = 10_000L
        const val POCKET_BRIGHTNESS = 0.01f
    }
}
