package com.metaglance.android.pipeline

import android.graphics.Bitmap
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.metaglance.core.image.FaceResult
import com.metaglance.core.image.I420
import com.metaglance.core.image.RawFrame
import com.metaglance.core.image.RectPx
import java.util.concurrent.ExecutionException

/**
 * Finds the faces in a frame with ML Kit, on the phone. Each call blocks until ML Kit is done, so do not call it
 * on the main thread. Each failure gives `FaceResult.Failed`, and the caller then drops the frame.
 */
class FaceFinder {
    private val detector = FaceDetection.getClient(
        FaceDetectorOptions.Builder()
            .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
            .setMinFaceSize(MIN_FACE_SIZE)
            .build()
    )

    fun find(frame: RawFrame): FaceResult = find {
        InputImage.fromByteArray(I420.toNv21(frame.i420, frame.width, frame.height), frame.width, frame.height, 0, InputImage.IMAGE_FORMAT_NV21)
    }

    fun find(bitmap: Bitmap): FaceResult = find { InputImage.fromBitmap(bitmap, 0) }

    fun close() = detector.close()

    private fun find(image: () -> InputImage): FaceResult = try {
        val faces = Tasks.await(detector.process(image()))
        FaceResult.Found(faces.map { face -> face.boundingBox.let { RectPx(it.left, it.top, it.width(), it.height()) } })
    } catch (_: ExecutionException) {
        FaceResult.Failed
    } catch (_: IllegalArgumentException) {
        // A frame with a size that is not a frame size.
        FaceResult.Failed
    } catch (_: InterruptedException) {
        Thread.currentThread().interrupt()
        FaceResult.Failed
    }

    private companion object {
        /** The smallest face that the detector reports, as a part of the image width. */
        const val MIN_FACE_SIZE = 0.05f
    }
}
