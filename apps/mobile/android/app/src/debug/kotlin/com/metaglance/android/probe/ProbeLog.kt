package com.metaglance.android.probe

import android.util.Log
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** The log of one probe run. A line goes to [onLine] (the screen), to Logcat with the tag `Glance`, and to [file]. */
class ProbeLog(dir: File) {
    val file: File = File(dir, "probe-${SimpleDateFormat("yyyyMMdd-HHmmss", Locale.US).format(Date())}.log")

    /** Runs on the thread of the caller of [line]. */
    var onLine: (String) -> Unit = {}

    private val clock = SimpleDateFormat("HH:mm:ss.SSS", Locale.US)

    init {
        dir.mkdirs()
    }

    @Synchronized
    fun line(message: String) {
        val text = "${clock.format(Date())} $message"
        Log.i(TAG, message)
        try {
            file.appendText(text + "\n")
        } catch (e: java.io.IOException) {
            Log.w(TAG, "the probe log file is not writable: ${e.message}")
        }
        onLine(text)
    }

    private companion object {
        const val TAG = "Glance"
    }
}
