package com.metaglance.android

import android.content.Context
import android.content.Intent
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.metaglance.android.mock.MockMenuActivity
import com.metaglance.android.store.AddProductActivity
import com.metaglance.android.store.StoreItemsActivity
import com.metaglance.android.support.waitUntil
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The debug screens "Add product" and "Store items". No test opens the scanner, the camera app, or the photo
 * picker: they are screens of Android and of Google Play services. Each test uses a server address where no
 * server listens, so no test changes a store list.
 */
@RunWith(AndroidJUnit4::class)
class AddProductScreenTest {
    private lateinit var targetContext: Context
    private lateinit var serverUrlBefore: String

    private val glance: GlanceApp get() = targetContext.applicationContext as GlanceApp

    @Before
    fun setUp() {
        targetContext = InstrumentationRegistry.getInstrumentation().targetContext
        serverUrlBefore = glance.profileStore.serverUrl
        glance.profileStore.serverUrl = NO_SERVER
    }

    @After
    fun tearDown() {
        glance.profileStore.serverUrl = if (serverUrlBefore == BuildConfig.SERVER_URL) "" else serverUrlBefore
    }

    private fun addProduct(): ActivityScenario<AddProductActivity> = ActivityScenario.launch(Intent(targetContext, AddProductActivity::class.java).putExtra(AddProductActivity.EXTRA_SCAN, false))

    @Test
    fun theMockMenuOpensBothScreens() {
        ActivityScenario.launch(MockMenuActivity::class.java).use { scenario ->
            val labels = views(scenario, Button::class.java).map { it.text.toString() }
            assertEquals(listOf("Add or edit a product", "Store items"), labels.take(2))
        }
    }

    @Test
    fun aTypedCodeWithAWrongCheckDigitGetsItsReason() {
        addProduct().use { scenario ->
            type(scenario, "Or type the digits under the barcode", "8076800195058")
            tap(scenario, "Use this code")
            awaitText(scenario, "The check digit is wrong. Read the digits again.")
            type(scenario, "Or type the digits under the barcode", "80768001950")
            tap(scenario, "Use this code")
            awaitText(scenario, "A barcode has 8, 12, or 13 digits. This one has 11.")
        }
    }

    @Test
    fun aRightCodeWithNoServerNamesTheServerAddress() {
        addProduct().use { scenario ->
            type(scenario, "Or type the digits under the barcode", "8076800195057")
            tap(scenario, "Use this code")
            awaitText(scenario, "No answer from the server at $NO_SERVER.")
            assertTrue(texts(scenario).any { it == "Code 8076800195057" })
        }
    }

    @Test
    fun theListWithNoServerNamesTheServerAddress() {
        ActivityScenario.launch(StoreItemsActivity::class.java).use { scenario ->
            awaitText(scenario, "No answer from the server at $NO_SERVER.")
        }
    }

    /** Each view of the type on the screen, from the top. It runs on the main thread. */
    private fun <V : View> views(scenario: ActivityScenario<*>, type: Class<V>): List<V> {
        val found = ArrayList<V>()
        fun walk(view: View) {
            if (type.isInstance(view)) found += type.cast(view)!!
            if (view is ViewGroup) for (index in 0 until view.childCount) walk(view.getChildAt(index))
        }
        scenario.onActivity { walk(it.window.decorView) }
        return found
    }

    private fun texts(scenario: ActivityScenario<*>): List<String> {
        val views = views(scenario, TextView::class.java)
        var texts = emptyList<String>()
        scenario.onActivity { texts = views.map { it.text.toString() } }
        return texts
    }

    private fun tap(scenario: ActivityScenario<*>, label: String) {
        val buttons = views(scenario, Button::class.java)
        scenario.onActivity { buttons.first { it.text.toString() == label }.performClick() }
    }

    private fun type(scenario: ActivityScenario<*>, caption: String, text: String) {
        val fields = views(scenario, EditText::class.java)
        scenario.onActivity { fields.first { it.contentDescription == caption }.setText(text) }
    }

    private fun awaitText(scenario: ActivityScenario<*>, start: String) {
        waitUntil("a line that starts with: $start", WAIT_MS, { texts(scenario).joinToString(" | ") }) { texts(scenario).any { it.startsWith(start) } }
    }

    private companion object {
        /** The discard port of the phone itself: no server listens there. */
        const val NO_SERVER = "http://127.0.0.1:9"
        const val WAIT_MS = 10_000L
    }
}
