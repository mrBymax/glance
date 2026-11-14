package com.metaglance.android.pipeline

import android.graphics.Bitmap
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import com.metaglance.core.barcode.TextElement
import com.metaglance.core.image.RectPx

/**
 * Reads the words of an image with ML Kit text recognition, on the phone, with the Latin model of the APK.
 * The pipeline uses it for the digits under a barcode that the scanner did not decode. `TextRows` of `core`
 * finds the product codes in the words.
 */
class DigitReader {
    private val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

    /** Blocks until ML Kit is done. Do not call it on the main thread. The image must have its text upright. */
    fun read(bitmap: Bitmap): List<TextElement> {
        val text = Tasks.await(recognizer.process(InputImage.fromBitmap(bitmap, 0)))
        return text.textBlocks.flatMap { it.lines }.flatMap { it.elements }.mapNotNull { element ->
            element.boundingBox?.let { TextElement(element.text, RectPx(it.left, it.top, it.width(), it.height())) }
        }
    }

    fun close() = recognizer.close()
}
