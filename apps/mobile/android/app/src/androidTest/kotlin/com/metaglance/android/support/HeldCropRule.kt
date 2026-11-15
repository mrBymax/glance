package com.metaglance.android.support

import androidx.test.platform.app.InstrumentationRegistry
import com.metaglance.android.GlanceApp
import com.metaglance.android.session.ProfileStore
import org.junit.rules.ExternalResource

/**
 * Sets the held crop to on during a test. `TestStreamRule` sets it to off for each test with mock glasses,
 * so give this rule an order above 0: it then runs inside that rule. After the test, the setting is back.
 */
class HeldCropRule : ExternalResource() {
    private var before: Boolean? = null

    private val store: ProfileStore
        get() = (InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as GlanceApp).profileStore

    override fun before() {
        before = store.heldCrop
        store.heldCrop = true
    }

    override fun after() {
        store.heldCrop = before
    }
}
