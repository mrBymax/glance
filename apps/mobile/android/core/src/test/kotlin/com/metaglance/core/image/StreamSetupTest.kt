package com.metaglance.core.image

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class StreamSetupTest {
    @Test fun `the default is HIGH at 7 frames each second`() {
        assertEquals(StreamSetup(StreamQuality.HIGH, 7), StreamSetup.DEFAULT)
    }

    @Test fun `the build of the app has the defaults of the stream`() {
        val build = File("../app/build.gradle.kts").readText()
        assertTrue(build.contains("localQuality(\"glance.streamQuality\", \"${StreamSetup.DEFAULT.quality.name}\")"))
        assertTrue(build.contains("localInt(\"glance.streamFps\", ${StreamSetup.DEFAULT.fps})"))
    }

    @Test fun `each quality has the frame size of the DAT SDK`() {
        assertEquals(listOf("HIGH 720 x 1280", "MEDIUM 504 x 896", "LOW 360 x 640"), StreamQuality.entries.map { "${it.name} ${it.width} x ${it.height}" })
    }

    @Test fun `reads the name of a quality in each case, with spaces around it`() {
        assertEquals(StreamQuality.HIGH, StreamSetup.quality("HIGH"))
        assertEquals(StreamQuality.LOW, StreamSetup.quality(" low "))
        assertEquals(StreamQuality.MEDIUM, StreamSetup.quality("Medium"))
        for (text in listOf("", "720", "HIGHER", "med")) assertNull(text, StreamSetup.quality(text))
    }

    @Test fun `brings the values of the build and of the store to values that the SDK accepts`() {
        assertEquals(StreamSetup(StreamQuality.HIGH, 30), StreamSetup.within("high", 30))
        assertEquals(StreamSetup(StreamQuality.HIGH, 7), StreamSetup.within("4K", 7))
        assertEquals(listOf(2, 2, 2, 2, 7, 7, 7, 15, 15, 24, 24, 30, 30), listOf(-1, 0, 2, 4, 5, 7, 11, 12, 19, 20, 27, 28, 1000).map { StreamSetup.within("LOW", it).fps })
    }

    @Test fun `the menu goes from each value to the next one, and from the last to the first`() {
        assertEquals(listOf(StreamQuality.MEDIUM, StreamQuality.LOW, StreamQuality.HIGH), StreamQuality.entries.map { StreamSetup(it, 7).nextQuality().quality })
        assertEquals(listOf(7, 15, 24, 30, 2), StreamSetup.FRAME_RATES.map { StreamSetup(StreamQuality.LOW, it).nextFps().fps })
    }

    @Test fun `the log line names the quality and the frame rate`() {
        assertEquals("stream config: quality=HIGH fps=7", StreamSetup.DEFAULT.logLine)
        assertEquals("stream config: quality=HIGH fps=30", StreamSetup(StreamQuality.HIGH, 30).logLine)
    }

    // A rule that lasts over one missed frame needs a gap of more than 2 frame times.
    @Test fun `a gap for one missed frame grows at a low frame rate`() {
        for (fps in listOf(7, 15, 24, 30)) {
            assertEquals(600, StreamSetup(StreamQuality.MEDIUM, fps).gapMs(600))
            assertEquals(1000, StreamSetup(StreamQuality.MEDIUM, fps).gapMs(1000))
        }
        assertEquals(1250, StreamSetup(StreamQuality.MEDIUM, 2).gapMs(600))
        assertEquals(1250, StreamSetup(StreamQuality.MEDIUM, 2).gapMs(1000))
        assertEquals(1500, StreamSetup(StreamQuality.MEDIUM, 2).gapMs(1500))
    }

    @Test fun `the upload has a center crop with even sides at each quality`() {
        val sizes = StreamQuality.entries.map { FrameGeometry.outputSize(FrameGeometry.centerCrop(it.width, it.height)) }
        assertEquals(listOf(494 to 768, 402 to 626, 288 to 448), sizes)
    }
}
