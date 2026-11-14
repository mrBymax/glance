package com.metaglance.android

import android.graphics.BitmapFactory
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.metaglance.android.pipeline.FaceFinder
import com.metaglance.android.support.TestClips
import com.metaglance.core.image.FaceResult
import com.metaglance.core.image.RawFrame
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith

/**
 * `FaceFinder` with ML Kit on the phone: the detector runs, and an image with no face gives an empty list.
 * No test image holds a face. The check with a face is manual work: Plan 2 Task 18 Step 5.
 */
@RunWith(AndroidJUnit4::class)
class FaceFinderTest {
    private val finder = FaceFinder()

    @After
    fun tearDown() = finder.close()

    @Test
    fun anImageWithNoFaceGivesAnEmptyList() {
        val context = InstrumentationRegistry.getInstrumentation().context
        val bitmap = context.assets.open(TestClips.SCENE_IMAGE).use(BitmapFactory::decodeStream)
        assertEquals(FaceResult.Found(emptyList()), finder.find(bitmap))
    }

    @Test
    fun aGrayFrameOfTheStreamGivesAnEmptyList() {
        val frame = RawFrame(ByteArray(WIDTH * HEIGHT * 3 / 2) { GRAY }, WIDTH, HEIGHT, 0)
        assertEquals(FaceResult.Found(emptyList()), finder.find(frame))
    }

    @Test
    fun aFrameWithASizeThatIsNoFrameSizeFails() {
        assertEquals(FaceResult.Failed, finder.find(RawFrame(ByteArray(0), 0, 0, 0)))
    }

    private companion object {
        const val WIDTH = 720
        const val HEIGHT = 1280
        val GRAY = 128.toByte()
    }
}
