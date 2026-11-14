package com.metaglance.android.pipeline

import android.graphics.Bitmap
import android.os.SystemClock
import com.metaglance.core.frame.FrameHeader
import com.metaglance.core.image.FaceResult
import com.metaglance.core.image.FramePrep
import com.metaglance.core.image.I420
import com.metaglance.core.image.RawFrame
import com.metaglance.core.image.SharpestFramePicker
import com.metaglance.core.image.Sharpness
import com.metaglance.core.image.UploadSkip
import com.metaglance.core.kiosk.KioskCode
import com.metaglance.core.kiosk.KioskDwell
import com.metaglance.core.kiosk.SeenCode
import java.io.ByteArrayOutputStream
import java.util.concurrent.ExecutionException

/**
 * The path of each frame of the stream: the kiosk code scan, then the upload of the sharpest frame of each
 * 500 ms. No frame is written to storage.
 *
 * `gate` returns the reason to skip an upload, or null. `onKioskText` gets the full code text, for example
 * `GL1 K3X7`, when the dwell rule reports it. `onUpload` gets a JPEG with its header.
 */
class FramePipeline(
    private val gate: () -> UploadSkip?,
    private val onKioskText: (String) -> Unit,
    private val onUpload: (FrameHeader, ByteArray) -> Unit,
    private val findFaces: ((RawFrame) -> FaceResult)? = null,
    private val crop: Boolean = false,
    /** Gives the number of the next upload. Without it, this pipeline counts its uploads from 1. */
    private val nextSeq: (() -> Int)? = null,
    private val log: (String) -> Unit
) {
    private val scanner = QrScanner()
    private val dwell = KioskDwell()
    private val picker = SharpestFramePicker<RawFrame>()
    private var seq = 0
    private var lastSkip: UploadSkip? = null
    private var scanFailed = false

    /** Call it for each frame, on one background thread. It blocks while ML Kit reads the frame. */
    fun onFrame(frame: RawFrame) {
        val nowMs = SystemClock.elapsedRealtime()
        dwell.onFrame(nowMs, kioskCodes(frame))?.let { onKioskText(KioskCode.format(it)) }

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

    fun close() = scanner.close()

    private fun kioskCodes(frame: RawFrame): List<SeenCode> {
        val hits = try {
            scanner.scan(I420.toNv21(frame.i420, frame.width, frame.height), frame.width, frame.height)
        } catch (e: ExecutionException) {
            // A scan that fails is a frame with no code. The upload of the frame does not depend on it.
            if (!scanFailed) log("qr scan failed: ${e.cause?.message ?: e.message}")
            scanFailed = true
            return emptyList()
        }
        scanFailed = false
        return hits.mapNotNull { hit -> KioskCode.parse(hit.text)?.let { SeenCode(it, hit.areaPx) } }
    }

    private companion object {
        const val JPEG_QUALITY = 80
    }
}
