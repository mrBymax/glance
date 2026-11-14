package com.metaglance.core.barcode

import com.metaglance.core.contract.BarcodeSource

/** One valid product code that one frame gave. `code` is as the phone read it: 8, 12, or 13 digits. */
data class CodeRead(val code: String, val source: BarcodeSource)

/**
 * Decides when the phone reports a product code. One frame can give a wrong code, so a code counts only when
 * frames agree: `barcodeReads` equal reads of the decoder inside `barcodeWindowMs`, or `ocrReads` equal reads
 * inside `ocrWindowMs`. OCR has no checksum of its own, so it needs more reads. A read of the decoder also counts
 * as an OCR read. A different code starts the count again. Two reads are equal when their 13-digit forms are equal.
 *
 * After the first report, the code is reported one time each `repeatMs` while it stays in view, as a kiosk code.
 * The appearance lasts over a gap of `gapMs` with no read, because a scan can miss a frame.
 */
class BarcodeVote(
    private val barcodeReads: Int = 2,
    private val barcodeWindowMs: Long = 1500,
    private val ocrReads: Int = 3,
    private val ocrWindowMs: Long = 2500,
    private val repeatMs: Long = 1000,
    private val gapMs: Long = DEFAULT_GAP_MS
) {
    private class Read(val atMs: Long, val source: BarcodeSource)

    private var candidate: String? = null
    private val reads = ArrayDeque<Read>()
    private var acceptedSource: BarcodeSource? = null
    private var lastReadMs = 0L
    private var lastReportMs: Long? = null

    /** True from the first report of a code until its appearance ends. */
    val accepted: Boolean get() = acceptedSource != null

    /** Returns the code to report now, or null. Call it for each frame, with null for a frame that gave no valid code. */
    fun onFrame(nowMs: Long, read: CodeRead?): CodeRead? {
        if (accepted && nowMs - lastReadMs > gapMs) reset()
        if (read == null) return null
        // A decoder can give a UPC-A code with 12 digits, and OCR the same code with 13.
        val gtin = Gtin.normalize(read.code) ?: read.code
        if (gtin != candidate) {
            reset()
            candidate = gtin
        }
        lastReadMs = nowMs
        val source = acceptedSource ?: count(nowMs, read.source) ?: return null
        acceptedSource = source
        val lastReport = lastReportMs
        if (lastReport != null && nowMs - lastReport < repeatMs) return null
        lastReportMs = nowMs
        return CodeRead(read.code, source)
    }

    /** Adds one read, and returns the source of the rule that the reads now meet, or null. */
    private fun count(nowMs: Long, source: BarcodeSource): BarcodeSource? {
        reads.addLast(Read(nowMs, source))
        while (nowMs - reads.first().atMs > ocrWindowMs) reads.removeFirst()
        val decoded = reads.count { it.source == BarcodeSource.BARCODE && nowMs - it.atMs <= barcodeWindowMs }
        return when {
            decoded >= barcodeReads -> BarcodeSource.BARCODE
            reads.size >= ocrReads -> BarcodeSource.OCR
            else -> null
        }
    }

    private fun reset() {
        candidate = null
        reads.clear()
        acceptedSource = null
        lastReportMs = null
    }

    companion object {
        const val DEFAULT_GAP_MS = 1000L
    }
}
