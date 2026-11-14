package com.metaglance.android

import android.content.Context
import android.view.WindowManager
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.test.ext.junit.rules.ActivityScenarioRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.metaglance.android.support.WebPage
import com.metaglance.android.support.onMainSync
import com.metaglance.android.support.requireSilentPhone
import com.metaglance.android.support.waitUntil
import com.metaglance.core.contract.PageToNative
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The native side of pocket mode: the check of Plan 2 Task 19 Step 4 that needs no hand.
 * The buttons of the placeholder page send the messages.
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
    fun pocketModeDimsTheScreenAndHidesTheBars() {
        assertEquals(WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE, brightness(), 0f)
        page.clickButton("pocket.set on")
        waitUntil("the screen is dim", STEP_MS) { brightness() == POCKET_BRIGHTNESS }
        waitUntil("the system bars are hidden", STEP_MS) { !barsVisible() }

        page.clickButton("pocket.set off")
        waitUntil("the brightness follows the phone again", STEP_MS) { brightness() == WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE }
        waitUntil("the system bars show", STEP_MS) { barsVisible() }
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
