package com.metaglance.core.image

import com.metaglance.core.frame.FrameCrop
import com.metaglance.core.frame.FrameHeader
import com.metaglance.core.frame.FrameSize
import com.metaglance.core.frame.FrameView
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class HeldRegionTest {
    private fun cup(box: RectPx, score: Float = 0.4f) = DetectedObject("cup", score, box)

    @Test fun `the detector image has a long side of 640 at most and even sides`() {
        assertEquals(360 to 640, HeldRegion.detectorSize(720, 1280))
        assertEquals(360 to 640, HeldRegion.detectorSize(504, 896))
        assertEquals(360 to 640, HeldRegion.detectorSize(360, 640))
        assertEquals(480 to 640, HeldRegion.detectorSize(1080, 1440))
        assertEquals(200 to 300, HeldRegion.detectorSize(200, 300))
    }

    @Test fun `takes the largest container that fills 3 percent of the image`() {
        val small = cup(RectPx(10, 10, 40, 60))
        val can = cup(RectPx(200, 300, 83, 224))
        val bottle = DetectedObject("bottle", 0.2f, RectPx(20, 300, 70, 120))
        assertEquals(can.box, HeldRegion.choose(listOf(small, bottle, can), 360, 640))
        // 3 percent of 360 x 640 are 6912 pixels. The bottle has 8400.
        assertEquals(bottle.box, HeldRegion.choose(listOf(small, bottle), 360, 640))
        assertNull(HeldRegion.choose(listOf(small), 360, 640))
        assertNull(HeldRegion.choose(emptyList(), 360, 640))
    }

    @Test fun `a can on a table far away is too small, and a box of half the image is no product in a hand`() {
        assertNull(HeldRegion.choose(listOf(cup(RectPx(100, 100, 40, 90))), 360, 640))
        assertNull(HeldRegion.choose(listOf(cup(RectPx(0, 0, 300, 400))), 360, 640))
    }

    @Test fun `ignores a low score and each class that is no product`() {
        val box = RectPx(200, 300, 83, 224)
        assertNull(HeldRegion.choose(listOf(cup(box, score = 0.14f)), 360, 640))
        assertEquals(box, HeldRegion.choose(listOf(cup(box, score = 0.15f)), 360, 640))
        for (label in listOf("laptop", "person", "keyboard", "cell phone", "tv")) {
            assertNull(label, HeldRegion.choose(listOf(DetectedObject(label, 0.9f, box)), 360, 640))
        }
        for (label in listOf("cup", "bottle", "wine glass", "vase", "bowl", "banana", "apple", "orange")) {
            assertEquals(label, box, HeldRegion.choose(listOf(DetectedObject(label, 0.9f, box)), 360, 640))
        }
    }

    @Test fun `clips a box to the image`() {
        assertEquals(RectPx(300, 500, 60, 140), HeldRegion.choose(listOf(cup(RectPx(300, 500, 90, 200))), 360, 640))
        assertEquals(RectPx(0, 0, 80, 150), HeldRegion.choose(listOf(cup(RectPx(-10, -20, 90, 170))), 360, 640))
    }

    @Test fun `maps a box of the detector image to the frame and never makes it smaller`() {
        assertEquals(RectPx(400, 600, 166, 448), HeldRegion.toFrame(RectPx(200, 300, 83, 224), 360, 640, 720, 1280))
        assertEquals(RectPx(280, 420, 117, 314), HeldRegion.toFrame(RectPx(200, 300, 83, 224), 360, 640, 504, 896))
        assertEquals(RectPx(200, 300, 83, 224), HeldRegion.toFrame(RectPx(200, 300, 83, 224), 360, 640, 360, 640))
    }

    @Test fun `the crop adds 30 percent on each side, and its short side is half of its long side at least`() {
        // 166 x 448 with the margin is 264 x 716. Half of 716 is 358.
        assertEquals(RectPx(304, 366, 358, 716), HeldRegion.crop(RectPx(400, 500, 166, 448), 720, 1280))
        // 300 x 100 with the margin is 480 x 160, and the height becomes 240.
        assertEquals(RectPx(110, 480, 480, 240), HeldRegion.crop(RectPx(200, 550, 300, 100), 720, 1280))
    }

    @Test fun `a crop at the edge moves into the frame and keeps its size`() {
        assertEquals(RectPx(496, 832, 224, 448), HeldRegion.crop(RectPx(600, 1000, 120, 280), 720, 1280))
        assertEquals(RectPx(0, 0, 264, 448), HeldRegion.crop(RectPx(0, 0, 166, 280), 720, 1280))
    }

    @Test fun `a small region gives a crop of 224 pixels on each side`() {
        assertEquals(RectPx(8, 8, 224, 224), HeldRegion.crop(RectPx(100, 100, 40, 40), 504, 896))
    }

    @Test fun `a crop is never larger than the frame`() {
        assertEquals(RectPx(0, 0, 360, 640), HeldRegion.crop(RectPx(20, 40, 300, 560), 360, 640))
        assertEquals(RectPx(0, 0, 200, 224), HeldRegion.crop(RectPx(50, 50, 40, 40), 200, 300))
    }

    @Test fun `each value of a crop is even, so the crop starts on a chroma sample`() {
        assertEquals(RectPx(14, 138, 224, 224), HeldRegion.crop(RectPx(101, 201, 51, 101), 504, 896))
        val crop = HeldRegion.crop(RectPx(333, 777, 131, 299), 720, 1280)
        for (value in listOf(crop.left, crop.top, crop.width, crop.height)) assertEquals(0, value % 2)
    }

    @Test fun `a frame with a region goes out as a crop, each time`() {
        val uploads = HeldUploads()
        assertEquals(FrameView.CROP, uploads.next(0, region = true))
        assertEquals(FrameView.CROP, uploads.next(150, region = true))
        assertEquals(FrameView.CROP, uploads.next(300, region = true))
    }

    @Test fun `with no region the full frame goes out one time each second`() {
        val uploads = HeldUploads()
        assertEquals(FrameView.FULL, uploads.next(0, region = false))
        assertNull(uploads.next(150, region = false))
        assertNull(uploads.next(999, region = false))
        assertEquals(FrameView.FULL, uploads.next(1000, region = false))
        assertNull(uploads.next(1900, region = false))
        assertEquals(FrameView.FULL, uploads.next(2050, region = false))
    }

    @Test fun `a full frame waits one second after a crop, so it does not come between two crops`() {
        val uploads = HeldUploads()
        assertEquals(FrameView.CROP, uploads.next(0, region = true))
        assertNull(uploads.next(150, region = false))
        assertEquals(FrameView.CROP, uploads.next(300, region = true))
        assertNull(uploads.next(1200, region = false))
        assertEquals(FrameView.FULL, uploads.next(1300, region = false))
    }

    @Test fun `the counts give one part of the frame path line and start again`() {
        val counts = HeldCounts()
        assertEquals("held 0 of 0 frames, crop 0x, full 0x", counts.takeLine())
        repeat(5) { counts.onFrame(region = false) }
        repeat(3) { counts.onFrame(region = true) }
        counts.onUpload(FrameView.FULL, 432, 768)
        counts.onUpload(FrameView.CROP, 358, 716)
        counts.onUpload(FrameView.CROP, 224, 448)
        counts.onUpload(FrameView.CROP, 300, 600)
        assertEquals("held 3 of 8 frames, crop 3x, full 1x, median crop 300x600", counts.takeLine())
        assertEquals("held 0 of 0 frames, crop 0x, full 0x", counts.takeLine())
    }

    @Test fun `the header of a region has the place of the crop in the source image`() {
        val made = FrameHeader(3, 5L, 358, 716, blurred = true).withView(RectPx(304, 366, 358, 716), 720, 1280)
        assertEquals(FrameView.CROP, made.view)
        assertEquals(FrameCrop(304, 366, 358, 716), made.crop)
        assertEquals(FrameSize(720, 1280), made.source)
        val full = FrameHeader(3, 5L, 432, 768, blurred = true).withView(null, 720, 1280)
        assertEquals(FrameView.FULL, full.view)
        assertNull(full.crop)
        assertEquals(FrameSize(720, 1280), full.source)
    }

    @Test fun `the setting has a log line and a menu label`() {
        assertEquals("held crop: on", HeldRegion.logLine(true))
        assertEquals("held crop: off", HeldRegion.logLine(false))
        assertEquals("Held crop: on", HeldRegion.menuLabel(true))
        assertEquals("Held crop: off", HeldRegion.menuLabel(false))
        assertEquals(false, HeldRegion.DEFAULT_ON)
    }
}
