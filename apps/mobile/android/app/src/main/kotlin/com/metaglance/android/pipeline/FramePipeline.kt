package com.metaglance.android.pipeline

import android.graphics.Bitmap
import android.os.SystemClock
import com.metaglance.core.barcode.BarcodeRegion
import com.metaglance.core.barcode.BarcodeVote
import com.metaglance.core.barcode.CodeChoice
import com.metaglance.core.barcode.CodeRead
import com.metaglance.core.barcode.LabelPolicy
import com.metaglance.core.contract.BarcodeSource
import com.metaglance.core.frame.FrameHeader
import com.metaglance.core.image.FaceResult
import com.metaglance.core.image.FramePrep
import com.metaglance.core.image.I420
import com.metaglance.core.image.Pace
import com.metaglance.core.image.RawFrame
import com.metaglance.core.image.RectPx
import com.metaglance.core.image.SharpestFramePicker
import com.metaglance.core.image.Sharpness
import com.metaglance.core.image.UploadSkip
import com.metaglance.core.kiosk.KioskCode
import com.metaglance.core.kiosk.KioskDwell
import com.metaglance.core.kiosk.SeenCode
import java.io.ByteArrayOutputStream
import java.util.concurrent.ExecutionException
import java.util.concurrent.atomic.AtomicBoolean

/**
 * The path of each frame of the stream: the code scan, then the upload of the sharpest frame of each 300 ms.
 * No frame is written to storage.
 *
 * One scan of the frame gives the kiosk code and the product barcode. A barcode region that did not decode is
 * read again in a larger scale, and then with OCR for the digits under the bars. `BarcodeVote` decides when a
 * product code is reported, and `LabelPolicy` decides when a still photo must read the code.
 *
 * `gate` returns the reason to skip an upload, or null. `onKioskText` gets the full code text, for example
 * `GL1 K3X7`, when the dwell rule reports it. `onBarcode` gets a product code when the vote reports it.
 * `onLabelStill` says that the caller must take one still now. `onUpload` gets a JPEG with its header.
 * Each callback runs on the frame thread.
 */
class FramePipeline(
    private val gate: () -> UploadSkip?,
    private val onKioskText: (String) -> Unit,
    private val onUpload: (FrameHeader, ByteArray) -> Unit,
    private val onBarcode: (CodeRead) -> Unit = {},
    private val onLabelStill: () -> Unit = {},
    private val findFaces: ((RawFrame) -> FaceResult)? = null,
    private val crop: Boolean = false,
    /** Gives the number of the next upload. Without it, this pipeline counts its uploads from 1. */
    private val nextSeq: (() -> Int)? = null,
    private val label: LabelPolicy = LabelPolicy(),
    private val log: (String) -> Unit
) {
    private val scanner = CodeScanner()
    private val digits = DigitReader()
    private val dwell = KioskDwell()
    private val vote = BarcodeVote()
    private val ocrPace = Pace(OCR_EVERY_MS)
    private val labelRequested = AtomicBoolean()
    private val stillGaveCode = AtomicBoolean()
    private val picker = SharpestFramePicker<RawFrame>()
    private var seq = 0
    private var lastSkip: UploadSkip? = null
    private val failedSteps = HashSet<String>()

    /** Call it for each frame, on one background thread. It blocks while ML Kit reads the frame. */
    fun onFrame(frame: RawFrame) {
        val nowMs = SystemClock.elapsedRealtime()
        // The one NV21 copy of the frame. The steps for a region read the Y plane of the frame itself.
        val hits = reading("code scan", emptyList()) { scanner.scan(I420.toNv21(frame.i420, frame.width, frame.height), frame.width, frame.height) }
        val kioskCodes = hits.filter { it.isQr }.mapNotNull { hit -> hit.text?.let(KioskCode::parse)?.let { SeenCode(it, hit.areaPx) } }
        dwell.onFrame(nowMs, kioskCodes)?.let { onKioskText(KioskCode.format(it)) }
        readProduct(nowMs, frame, hits.filterNot { it.isQr })

        val picked = picker.offer(nowMs, frame, Sharpness.of(frame.i420, frame.width, frame.height)) ?: return

        val skip = gate()
        if (skip != lastSkip) {
            log(if (skip == null) "upload on" else "upload off: $skip")
            lastSkip = skip
        }
        if (skip != null) return

        val faces = findFaces?.invoke(picked) ?: FaceResult.NotRun
        val prepared = FramePrep.prepare(picked, faces, crop)
        if (prepared == null) {
            log("frame dropped: face detection failed")
            return
        }
        val bitmap = Bitmap.createBitmap(prepared.argb, prepared.width, prepared.height, Bitmap.Config.ARGB_8888)
        val jpeg = ByteArrayOutputStream().also { bitmap.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, it) }.toByteArray()
        bitmap.recycle()

        seq = nextSeq?.invoke() ?: (seq + 1)
        onUpload(FrameHeader(seq, System.currentTimeMillis(), prepared.width, prepared.height, prepared.blurred), jpeg)
    }

    /** The server asked for a still with `still.request`. The next frame gives the request to the label policy. */
    fun requestLabelStill() = labelRequested.set(true)

    /** The phone read a code in the label still. The next frame tells the label policy. */
    fun onLabelStillCode() = stillGaveCode.set(true)

    fun close() {
        scanner.close()
        digits.close()
    }

    private fun readProduct(nowMs: Long, frame: RawFrame, hits: List<CodeHit>) {
        val productHits = hits.map { it.toProductHit() }
        val decoded = CodeChoice.decoded(productHits)
        val region = if (decoded != null) null else CodeChoice.region(productHits, frame.width, frame.height)
        val read = when {
            decoded != null -> CodeRead(decoded, BarcodeSource.BARCODE)
            region != null -> readRegion(nowMs, frame, region)
            else -> null
        }
        if (read != null && !vote.accepted) log("barcode read ${read.code} ${read.source.name.lowercase()}")
        vote.onFrame(nowMs, read)?.let(onBarcode)
        if (stillGaveCode.getAndSet(false)) label.onStillCode()
        // A frame that waits in the socket is no reason to drop a still.
        val canUpload = gate().let { it == null || it == UploadSkip.STILL_SENDING }
        val requested = labelRequested.getAndSet(false)
        if (label.onFrame(nowMs, decoded != null || region != null, vote.accepted, requested, canUpload)) {
            // Why the still: a person who reads the log must see if the scanner or the server asked.
            log("label still asked: " + if (requested) "server request" else "region $region in ${frame.width}x${frame.height}")
            onLabelStill()
        }
    }

    /** The second and the third way to read a code: the region in a larger scale, then the digits under the bars. */
    private fun readRegion(nowMs: Long, frame: RawFrame, region: RectPx): CodeRead? {
        val bars = BarcodeRegion.forDecode(region, frame.width, frame.height) ?: return null
        val decoded = reading("region scan", emptyList()) { frame.regionBitmap(bars).use { scanner.scan(it) } }.firstNotNullOfOrNull { it.productCode }
        if (decoded != null) return CodeRead(decoded, BarcodeSource.BARCODE)

        if (!ocrPace.tryRun(nowMs)) return null
        val withDigits = BarcodeRegion.forDigits(region, frame.width, frame.height) ?: return null
        val words = reading("digit read", emptyList()) { frame.regionBitmap(withDigits).use { digits.read(it) } }
        return CodeChoice.ofWords(words)
    }

    private fun <T> Bitmap.use(read: (Bitmap) -> T): T = try {
        read(this)
    } finally {
        recycle()
    }

    /** A step of ML Kit that fails is a frame with no code. The upload of the frame does not depend on it. */
    private fun <T> reading(step: String, fallback: T, read: () -> T): T = try {
        read().also { failedSteps -= step }
    } catch (e: ExecutionException) {
        // One line for each row of failures of a step.
        if (failedSteps.add(step)) log("$step failed: ${e.cause?.message ?: e.message}")
        fallback
    }

    private companion object {
        const val JPEG_QUALITY = 80

        /** OCR runs at most 3 times each second, because it takes longer than the scan of a frame. */
        const val OCR_EVERY_MS = 333L
    }
}
