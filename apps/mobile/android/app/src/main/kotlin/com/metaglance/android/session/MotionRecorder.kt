package com.metaglance.android.session

import com.metaglance.core.gesture.HeadSample
import com.metaglance.core.gesture.MotionCsv
import com.metaglance.core.input.HeadWindowListener
import java.io.File
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Writes the motion samples of each head window to a file of its own in `dir`, the motion folder of the probe.
 * A file has the format of `MotionCsv` with the arrival time of each sample, so `MotionReplayTest` replays it,
 * and mock glasses play it. The file is written when the head window ends.
 *
 * `HeadInput` calls it, one call at a time.
 */
class MotionRecorder(private val dir: File, private val scope: CoroutineScope, private val log: (String) -> Unit) : HeadWindowListener {
    private var lines: ArrayList<String>? = null
    private var rows = 0

    override fun onOpen(promptId: String, doneMs: Long) {
        rows = 0
        lines = arrayListOf("# The head window of the prompt $promptId. Its line ended at $doneMs ms on the clock of the phone.")
    }

    override fun onSample(sample: HeadSample, arrivalMs: Long) {
        // A profile with no head window keeps a window open for minutes.
        if (rows >= MAX_ROWS) return
        lines?.add(MotionCsv.formatTimed(MotionCsv.row(sample), arrivalMs))
        rows += 1
    }

    override fun onClose(promptId: String) {
        val text = lines ?: return
        lines = null
        if (rows == 0) return
        val count = rows
        val name = "window-${SimpleDateFormat("yyyyMMdd-HHmmss", Locale.US).format(Date())}-${promptId.replace(Regex("[^A-Za-z0-9_-]"), "_")}.csv"
        scope.launch(Dispatchers.IO) {
            try {
                dir.mkdirs()
                File(dir, name).writeText(text.joinToString("\n", postfix = "\n"))
                log("motion recorded: motion/$name rows=$count")
            } catch (e: IOException) {
                log("motion not recorded: motion/$name ${e.message}")
            }
        }
    }

    private companion object {
        /** 2 minutes at 30 Hz. */
        const val MAX_ROWS = 3600
    }
}
