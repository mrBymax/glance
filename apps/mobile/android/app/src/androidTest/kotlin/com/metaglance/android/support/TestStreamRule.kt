package com.metaglance.android.support

import androidx.test.platform.app.InstrumentationRegistry
import com.metaglance.android.GlanceApp
import com.metaglance.android.session.ProfileStore
import com.metaglance.core.image.StreamQuality
import org.junit.rules.ExternalResource

/**
 * Makes the app ask for a stream of 720 x 1280 at 7 frames each second during a test: the clips and the checks
 * of the tests are for that stream. It also sets the held crop to off: no clip shows a product in a hand, and
 * the checks are for the full frame of each upload window. `HeldCropRule` sets it to on for a test of the crop.
 * After the test, the settings of the phone are back.
 */
class TestStreamRule : ExternalResource() {
    private var qualityBefore: StreamQuality? = null
    private var fpsBefore: Int? = null
    private var heldCropBefore: Boolean? = null

    private val store: ProfileStore
        get() = (InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as GlanceApp).profileStore

    override fun before() {
        qualityBefore = store.streamQuality
        fpsBefore = store.streamFps
        store.streamQuality = StreamQuality.HIGH
        store.streamFps = FPS
        heldCropBefore = store.heldCrop
        store.heldCrop = false
    }

    override fun after() {
        store.streamQuality = qualityBefore
        store.streamFps = fpsBefore
        store.heldCrop = heldCropBefore
    }

    private companion object {
        const val FPS = 7
    }
}
