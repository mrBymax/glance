package com.metaglance.android.support

import androidx.test.platform.app.InstrumentationRegistry
import com.metaglance.android.GlanceApp
import com.metaglance.android.session.ProfileStore
import org.junit.rules.ExternalResource

/**
 * Sets the second look still to on during a test: the app takes that still only with the setting, which is off
 * by default. After the test, the setting of the phone is back.
 */
class SecondLookRule : ExternalResource() {
    private var before: Boolean? = null

    private val store: ProfileStore
        get() = (InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as GlanceApp).profileStore

    override fun before() {
        before = store.secondLookStill
        store.secondLookStill = true
    }

    override fun after() {
        store.secondLookStill = before
    }
}
