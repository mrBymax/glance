package com.metaglance.android

import android.graphics.BitmapFactory
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.metaglance.android.pipeline.HeldFinder
import com.metaglance.android.support.TestClips
import com.metaglance.core.image.RawFrame
import org.junit.After
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * `HeldFinder` with MediaPipe on the phone: the model of the APK loads, and the detector runs on a frame and on
 * an image. No test image shows a product in a hand, so no test checks a region. That check is manual work
 * with the glasses: see "The crop of the held product" in the README.
 */
@RunWith(AndroidJUnit4::class)
class HeldFinderTest {
    private val log = ArrayList<String>()
    private var finder: HeldFinder? = null

    @Before
    fun setUp() {
        finder = HeldFinder.open(InstrumentationRegistry.getInstrumentation().targetContext) { log += it }
    }

    @After
    fun tearDown() {
        finder?.close()
    }

    @Test
    fun theDetectorStartsWithTheModelOfTheApk() {
        assertNotNull("The detector did not start: $log", finder)
    }

    @Test
    fun aGrayFrameOfTheStreamHasNoRegion() {
        val frame = RawFrame(ByteArray(WIDTH * HEIGHT * 3 / 2) { GRAY }, WIDTH, HEIGHT, 0)
        assertNull(checkNotNull(finder).find(frame))
    }

    @Test
    fun aRegionOfTheSceneImageIsInsideTheImage() {
        val context = InstrumentationRegistry.getInstrumentation().context
        val bitmap = context.assets.open(TestClips.SCENE_IMAGE).use(BitmapFactory::decodeStream)
        // The scene shows no product in a hand. A region is no failure: the detector is generous.
        val region = checkNotNull(finder).find(bitmap) ?: return
        assertTrue("$region in ${bitmap.width}x${bitmap.height}", region.left >= 0 && region.top >= 0 && region.left + region.width <= bitmap.width && region.top + region.height <= bitmap.height)
    }

    private companion object {
        const val WIDTH = 720
        const val HEIGHT = 1280
        val GRAY = 128.toByte()
    }
}
