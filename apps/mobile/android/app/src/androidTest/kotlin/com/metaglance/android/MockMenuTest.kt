package com.metaglance.android

import android.content.Context
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.test.ext.junit.rules.ActivityScenarioRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.metaglance.android.mock.MockMenuActivity
import com.metaglance.android.support.onMainSync
import com.metaglance.android.support.requireSilentPhone
import com.metaglance.android.support.waitUntil
import com.metaglance.core.barcode.LabelTiming
import com.metaglance.core.gesture.Sensitivity
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The mock menu "Glance Mock" of Plan 2 Task 17: each test taps the items of the screen and reads its top line.
 * The items that open a picker or a prompt of Android are not tapped: `Phone camera`, `Still image`, and
 * `Replay CSV file`. `DeviceStatesTest` checks the states of a running session.
 */
@RunWith(AndroidJUnit4::class)
class MockMenuTest {
    @get:Rule
    val scenarioRule = ActivityScenarioRule(MockMenuActivity::class.java)

    private lateinit var targetContext: Context
    private lateinit var sensitivityBefore: Sensitivity
    private lateinit var serverUrlBefore: String
    private var placeholderBefore = false
    private var labelWaitBefore: Long? = null
    private var labelGapBefore: Long? = null

    private val glance: GlanceApp get() = targetContext.applicationContext as GlanceApp

    @Before
    fun setUp() {
        targetContext = InstrumentationRegistry.getInstrumentation().targetContext
        requireSilentPhone(targetContext)
        sensitivityBefore = glance.profileStore.sensitivity
        serverUrlBefore = glance.profileStore.serverUrl
        placeholderBefore = glance.profileStore.usePlaceholder
        labelWaitBefore = glance.profileStore.labelWaitMs
        labelGapBefore = glance.profileStore.labelGapMs
    }

    @After
    fun tearDown() {
        tap("Disable")
        awaitStatus("Mock mode off")
        onMainSync {
            glance.profileStore.sensitivity = sensitivityBefore
            glance.profileStore.serverUrl = if (serverUrlBefore == BuildConfig.SERVER_URL) "" else serverUrlBefore
            glance.profileStore.usePlaceholder = placeholderBefore
            glance.profileStore.labelWaitMs = labelWaitBefore
            glance.profileStore.labelGapMs = labelGapBefore
            glance.session.applySensitivity()
        }
    }

    @Test
    fun theMenuHasEachItemOfThePlan() {
        val labels = buttons().map { it.text.toString() }
        val missing = PLAN_ITEMS.filter { item -> labels.none { it == item || it.startsWith("$item:") } }
        assertEquals("Items that the menu does not have.", emptyList<String>(), missing)
    }

    @Test
    fun theTopLineFollowsTheMockGlasses() {
        tap("Enable (registered)")
        awaitStatus("Mock mode on, registered")
        awaitState("\"mock\":true")
        awaitState("\"registration\":\"registered\"")

        tap("Pair")
        awaitState("\"link\":\"connected\"")
        awaitState("\"worn\":true")

        tap("Battery 20")
        awaitState("\"battery\":20")
        tap("Thermal severe")
        awaitState("\"thermal\":5")
        tap("Doff")
        awaitState("\"worn\":false")
        tap("Don")
        awaitState("\"worn\":true")
        tap("Fold")
        awaitState("\"hingeOpen\":false")
        tap("Unfold")
        awaitState("\"hingeOpen\":true")
        tap("Power off")
        awaitState("\"link\":\"disconnected\"")
        tap("Power on")
        tap("Unfold")
        tap("Don")
        awaitState("\"link\":\"connected\"")

        tap("Camera: deny")
        awaitState("\"cameraPermission\":\"denied\"")
        tap("Camera: allow")
        awaitState("\"cameraPermission\":\"granted\"")

        tap("Meta AI missing")
        awaitState("\"metaAiInstalled\":false")
        tap("Update required")
        awaitState("\"updateRequired\":true")

        tap("Disable")
        awaitStatus("Mock mode off")
        awaitState("\"mock\":false")
        awaitState("\"metaAiInstalled\":true")
    }

    @Test
    fun aModeWithNoRegistrationIsNotRegistered() {
        tap("Enable (registered)")
        awaitState("\"registration\":\"registered\"")
        tap("Enable (not registered)")
        awaitStatus("Mock mode on, not registered")
        // MockDeviceKit reports UNAVAILABLE until the registration, not AVAILABLE.
        awaitState("\"registration\":\"unavailable\"")
        awaitState("\"mock\":true")
        tap("Pair")
        awaitStatus("Mock glasses paired")
    }

    @Test
    fun anItemWithNoMockGlassesSaysWhatToDo() {
        tap("Battery 20")
        awaitStatus("No mock glasses are paired. Tap Pair first.")
        tap("Replay nod")
        awaitStatus("No mock glasses are paired. Tap Pair first.")
        tap("Next registration fails")
        awaitStatus("Mock mode is off. Tap Enable first.")
    }

    @Test
    fun theAppItemsChangeTheStoredSettings() {
        tap("Sensitivity: firm")
        awaitStatus("Sensitivity: firm")
        assertEquals(Sensitivity.FIRM, glance.profileStore.sensitivity)

        scenarioRule.scenario.onActivity { activity ->
            checkNotNull(find<EditText>(activity)).setText("  http://127.0.0.1:9999 ")
        }
        tap("Save server URL")
        awaitStatus("Server URL: http://127.0.0.1:9999")
        assertEquals("http://127.0.0.1:9999", glance.profileStore.serverUrl)

        val before = glance.profileStore.usePlaceholder
        tap(if (before) "Use placeholder page: on" else "Use placeholder page: off")
        assertEquals(!before, glance.profileStore.usePlaceholder)
        assertTrue(buttons().any { it.text.toString() == if (before) "Use placeholder page: off" else "Use placeholder page: on" })
    }

    @Test
    fun theBarcodeFieldsChangeTheStoredWaits() {
        type("Barcode wait (ms)", "1200")
        type("Still gap (ms)", "8000")
        tap("Save barcode waits")
        awaitStatus("Barcode wait: 1200 ms. Still gap: 8000 ms. The next camera start uses them.")
        assertEquals(LabelTiming(waitMs = 1200, gapMs = 8000), glance.profileStore.labelTiming)

        // A number outside the limits becomes the nearest limit.
        type("Barcode wait (ms)", "5")
        type("Still gap (ms)", "999999")
        tap("Save barcode waits")
        awaitStatus("Barcode wait: 300 ms. Still gap: 60000 ms. The next camera start uses them.")
        assertEquals(LabelTiming(waitMs = 300, gapMs = 60_000), glance.profileStore.labelTiming)

        // An empty field gives the value of the build again.
        type("Barcode wait (ms)", "")
        type("Still gap (ms)", " ")
        tap("Save barcode waits")
        assertEquals(null, glance.profileStore.labelWaitMs)
        assertEquals(null, glance.profileStore.labelGapMs)
        assertEquals(LabelTiming.within(BuildConfig.LABEL_WAIT_MS, BuildConfig.LABEL_GAP_MS), glance.profileStore.labelTiming)
    }

    private fun type(hint: String, text: String) {
        scenarioRule.scenario.onActivity { activity ->
            val field = views<EditText>(activity).firstOrNull { it.hint?.toString() == hint }
            checkNotNull(field) { "The menu has no field \"$hint\"." }.setText(text)
        }
    }

    private fun tap(label: String) {
        scenarioRule.scenario.onActivity { activity ->
            val button = views<Button>(activity).firstOrNull { it.text.toString() == label }
            checkNotNull(button) { "The menu has no item \"$label\"." }.performClick()
        }
    }

    private fun buttons(): List<Button> {
        var found = emptyList<Button>()
        scenarioRule.scenario.onActivity { found = views<Button>(it) }
        return found
    }

    /** The first text view of the screen is the top line with both states. The second one is the status line. */
    private fun texts(): List<String> {
        var found = emptyList<String>()
        scenarioRule.scenario.onActivity { activity ->
            found = views<TextView>(activity).filter { it !is Button && it !is EditText }.map { it.text.toString() }
        }
        return found
    }

    private fun awaitState(part: String) = waitUntil("the top line shows $part", STEP_MS, { texts().first() }) { part in texts().first() }

    private fun awaitStatus(text: String) = waitUntil("the status line shows \"$text\"", STEP_MS, { texts()[1] }) { texts()[1] == text }

    private inline fun <reified T : View> find(activity: MockMenuActivity): T? = views<T>(activity).firstOrNull()

    private inline fun <reified T : View> views(activity: MockMenuActivity): List<T> = allViews(activity.findViewById(android.R.id.content)).filterIsInstance<T>()

    private fun allViews(view: View): List<View> = if (view is ViewGroup) {
        listOf(view) + (0 until view.childCount).flatMap { allViews(view.getChildAt(it)) }
    } else {
        listOf(view)
    }

    private companion object {
        const val STEP_MS = 10_000L

        /** The items of the table of Plan 2 Task 17, and the button that saves the server address. */
        val PLAN_ITEMS = listOf(
            "Enable (registered)", "Enable (not registered)", "Disable",
            "Pair", "Power on", "Power off", "Don", "Doff", "Fold", "Unfold",
            "Phone camera", "Still image",
            "Battery 100", "Battery 20", "Battery 10", "Battery 3", "Thermal none", "Thermal severe", "Thermal critical",
            "Tap", "Tap and hold", "Double tap", "Swipe",
            "Next registration fails", "Next registration works", "Camera: deny", "Camera: allow",
            "Replay nod", "Replay shake", "Replay CSV file",
            "Say add", "Say skip",
            "Meta AI missing", "Update required", "Stream error BATTERY_LOW", "Stream error THERMAL_HOT",
            "Save server URL", "Drop server link 10 s", "Sensitivity: gentle", "Sensitivity: normal", "Sensitivity: firm",
            "Use placeholder page", "Save barcode waits"
        )
    }
}
