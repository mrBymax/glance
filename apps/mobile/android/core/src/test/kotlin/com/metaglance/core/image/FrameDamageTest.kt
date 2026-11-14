package com.metaglance.core.image

import java.util.Random
import kotlin.math.sin
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class FrameDamageTest {
    private val width = 504
    private val height = 896

    /**
     * A scene with no block lattice: a slow change of light, 600 objects of 5 to 40 pixels at any place, two long
     * straight edges, and sensor noise. The same seed gives the same scene.
     */
    private fun scene(width: Int = this.width, height: Int = this.height): ByteArray {
        val random = Random(7)
        val luma = IntArray(width * height) { i -> 110 + (40 * sin(i % width / 90.0) + 30 * sin(i / width / 140.0)).toInt() }
        repeat(600) {
            val left = random.nextInt(width)
            val top = random.nextInt(height)
            val change = random.nextInt(121) - 60
            for (y in top until minOf(top + 5 + random.nextInt(36), height)) {
                // Each row starts one pixel later, so half of the objects have a slanted side.
                val slant = if (it % 2 == 0) (y - top) / 2 else 0
                for (x in left + slant until minOf(left + slant + 5 + random.nextInt(36), width)) luma[y * width + x] += change
            }
        }
        for (y in 0 until height) for (x in 203 until width) luma[y * width + x] += 25
        for (y in 411 until height) for (x in 0 until width) luma[y * width + x] -= 25
        return ByteArray(width * height) { (luma[it] + random.nextInt(7) - 3).coerceIn(16, 235).toByte() }
    }

    /** Each block of `size` pixels gets its mean, as a frame that lost all detail inside its blocks. */
    private fun blocks(luma: ByteArray, size: Int, offsetX: Int = 0, offsetY: Int = 0): ByteArray {
        val out = ByteArray(luma.size)
        for (top in offsetY - size until height step size) {
            for (left in offsetX - size until width step size) {
                val xs = maxOf(left, 0) until minOf(left + size, width)
                val ys = maxOf(top, 0) until minOf(top + size, height)
                if (xs.isEmpty() || ys.isEmpty()) continue
                var sum = 0
                for (y in ys) for (x in xs) sum += luma[y * width + x].toInt() and 0xFF
                val mean = (sum / (xs.count() * ys.count())).toByte()
                for (y in ys) out.fill(mean, y * width + xs.first, y * width + xs.last + 1)
            }
        }
        return out
    }

    /** A mean over `2 * radiusX + 1` by `2 * radiusY + 1` pixels. A pixel outside has the value of the nearest pixel inside. */
    private fun boxBlur(luma: ByteArray, radiusX: Int, radiusY: Int) = ByteArray(width * height) { i ->
        var sum = 0
        for (dy in -radiusY..radiusY) {
            for (dx in -radiusX..radiusX) {
                sum += luma[(i / width + dy).coerceIn(0, height - 1) * width + (i % width + dx).coerceIn(0, width - 1)].toInt() and 0xFF
            }
        }
        (sum / ((2 * radiusX + 1) * (2 * radiusY + 1))).toByte()
    }

    private fun damage(luma: ByteArray) = FrameDamage.of(luma, width, height)

    @Test fun `a scene with objects, long edges, and noise is not damaged`() {
        val score = damage(scene())
        assertTrue("score $score", score > 0.5 && score < 1.25)
        assertFalse(FrameDamage.isDamaged(scene(), width, height))
    }

    @Test fun `the scene is not damaged at each size of the stream`() {
        for ((w, h) in listOf(720 to 1280, 504 to 896, 360 to 640)) {
            val score = FrameDamage.of(scene(w, h), w, h)
            assertTrue("$w x $h score $score", score < 1.25)
        }
    }

    @Test fun `a frame of flat blocks is damaged, for blocks of 16, 32, and 64 pixels`() {
        for (size in listOf(16, 32, 64)) {
            val score = damage(blocks(scene(), size))
            assertTrue("blocks of $size: score $score", score >= 2 * FrameDamage.DAMAGED_AT)
        }
    }

    @Test fun `flat blocks that do not start at the frame corner are damaged too`() {
        for (size in listOf(16, 32, 64)) {
            val score = damage(blocks(scene(), size, offsetX = 5, offsetY = 9))
            assertTrue("blocks of $size: score $score", score >= 2 * FrameDamage.DAMAGED_AT)
        }
    }

    // The HEVC decoder smooths each block edge over some pixels.
    @Test fun `blocks with soft edges are damaged`() {
        val score = damage(boxBlur(blocks(scene(), 32), 1, 1))
        assertTrue("score $score", score >= 2 * FrameDamage.DAMAGED_AT)
    }

    @Test fun `damage in half of the frame is damage`() {
        val clean = scene()
        val broken = blocks(clean, 32)
        val half = ByteArray(clean.size) { if (it / width < height / 2) clean[it] else broken[it] }
        assertTrue(FrameDamage.isDamaged(half, width, height))
    }

    @Test fun `a blurred scene is not damaged, and it is less sharp than the scene`() {
        val clean = scene()
        for (blurred in listOf(boxBlur(clean, 6, 0), boxBlur(clean, 0, 6), boxBlur(clean, 2, 2))) {
            val score = damage(blurred)
            assertTrue("score $score", score < 1.25)
            assertTrue(Sharpness.of(blurred, width, height) < Sharpness.of(clean, width, height))
        }
    }

    @Test fun `a flat wall and a dark frame are not damaged`() {
        val random = Random(3)
        val wall = ByteArray(width * height) { (150 + random.nextInt(5) - 2).toByte() }
        val shaded = ByteArray(width * height) { (90 + 60 * (it % width) / width + 40 * (it / width) / height + random.nextInt(3) - 1).toByte() }
        val dark = ByteArray(width * height) { (16 + random.nextInt(4)).toByte() }
        val black = ByteArray(width * height) { 16 }
        for (frame in listOf(wall, shaded, dark, black)) assertEquals(0.0, damage(frame), 0.0)
    }

    @Test fun `one long edge on a block line in each direction is not damage`() {
        val random = Random(5)
        val luma = ByteArray(width * height) { i ->
            val step = (if (i % width >= 256) 40 else 0) + (if (i / width >= 448) 40 else 0)
            (80 + step + random.nextInt(5) - 2).toByte()
        }
        assertFalse(FrameDamage.isDamaged(luma, width, height))
    }

    @Test fun `reads only the luma plane, and a tiny frame gives 0`() {
        val i420 = scene() + ByteArray(width * height / 2) { 77 }
        assertEquals(damage(scene()), FrameDamage.of(i420, width, height), 0.0)
        assertEquals(0.0, FrameDamage.of(ByteArray(6), 2, 2), 0.0)
        assertEquals(0.0, FrameDamage.of(ByteArray(40 * 12 * 3 / 2), 40, 12), 0.0)
    }
}
