package com.metaglance.core.image

import kotlin.math.abs

/** The frame sizes that the glasses can stream. The names are the names of `VideoQuality` in the DAT SDK. */
enum class StreamQuality(val width: Int, val height: Int) {
    HIGH(720, 1280),
    MEDIUM(504, 896),
    LOW(360, 640)
}

/**
 * What the app asks of the camera stream. The glasses compress each frame for the bandwidth of Bluetooth, so a
 * smaller frame or a lower frame rate leaves more data for each frame. The glasses can still give less than
 * the app asked for: `StreamSize` and the `frame` log line show what arrives.
 */
data class StreamSetup(val quality: StreamQuality, val fps: Int) {
    val logLine: String get() = "stream config: quality=${quality.name} fps=$fps"

    fun nextQuality(): StreamSetup = copy(quality = StreamQuality.entries.let { it[(quality.ordinal + 1) % it.size] })

    fun nextFps(): StreamSetup = copy(fps = FRAME_RATES[(FRAME_RATES.indexOf(fps) + 1) % FRAME_RATES.size])

    /**
     * The gap of a rule that must last over one missed frame: `atLeastMs`, or 2.5 frame times when that is
     * longer. At 2 frames each second, one missed frame is a gap of 1000 ms.
     */
    fun gapMs(atLeastMs: Long): Long = maxOf(atLeastMs, 2500L / fps)

    companion object {
        /** The frame rates that `StreamConfiguration` of the DAT SDK accepts. */
        val FRAME_RATES = listOf(2, 7, 15, 24, 30)

        /**
         * The defaults of `glance.streamQuality` and `glance.streamFps` in the build of the app. The glasses
         * lowered a stream of 720 x 1280 to 504 x 896 in each session of 2026-11-14.
         */
        val DEFAULT = StreamSetup(StreamQuality.MEDIUM, 7)

        fun quality(name: String): StreamQuality? = StreamQuality.entries.firstOrNull { it.name.equals(name.trim(), ignoreCase = true) }

        /**
         * The setup for the values of the build and of the store. A name that is no quality gives the default
         * quality, and a frame rate that the SDK does not accept becomes the nearest one that it accepts.
         */
        fun within(qualityName: String, fps: Int): StreamSetup = StreamSetup(quality(qualityName) ?: DEFAULT.quality, FRAME_RATES.minBy { abs(it.toLong() - fps) })
    }
}
