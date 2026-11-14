package com.metaglance.android.probe

import android.content.pm.PackageManager
import android.graphics.Typeface
import android.os.Build
import android.os.Bundle
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import java.io.File

class ProbeActivity : AppCompatActivity() {
    private lateinit var log: ProbeLog
    private lateinit var buttons: LinearLayout
    private lateinit var logView: TextView
    private lateinit var logScroll: ScrollView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        buildLayout()
        log = ProbeLog(getExternalFilesDir("probe") ?: File(filesDir, "probe"))
        log.onLine = { text -> runOnUiThread { showLine(text) } }
        log.line("probe ready sdk=${Build.VERSION.SDK_INT} appId=${manifestAppId()}")
    }

    fun addButton(label: String, onClick: () -> Unit): Button {
        val button = Button(this)
        button.text = label
        button.isAllCaps = false
        button.setOnClickListener { onClick() }
        buttons.addView(button, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
        return button
    }

    private fun buildLayout() {
        buttons = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        val buttonScroll = ScrollView(this).apply { addView(buttons, MATCH_PARENT, WRAP_CONTENT) }
        logView = TextView(this).apply {
            typeface = Typeface.MONOSPACE
            textSize = LOG_TEXT_SP
            setTextIsSelectable(true)
        }
        logScroll = ScrollView(this).apply { addView(logView, MATCH_PARENT, WRAP_CONTENT) }
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            fitsSystemWindows = true
            addView(buttonScroll, LinearLayout.LayoutParams(MATCH_PARENT, 0, 1f))
            addView(logScroll, LinearLayout.LayoutParams(MATCH_PARENT, 0, 1f))
        }
        setContentView(root)
    }

    private fun showLine(text: String) {
        // The view keeps the newest lines only. The file holds each line.
        val lines = (logView.text.toString() + text + "\n").lines()
        logView.text = lines.takeLast(MAX_SCREEN_LINES).joinToString("\n")
        logScroll.post { logScroll.fullScroll(ScrollView.FOCUS_DOWN) }
    }

    // Android reads the manifest value "0" as an integer, so getString returns null for it.
    @Suppress("DEPRECATION")
    private fun manifestAppId(): String {
        val info = packageManager.getApplicationInfo(packageName, PackageManager.GET_META_DATA)
        return info.metaData?.get("com.meta.wearable.mwdat.APPLICATION_ID")?.toString() ?: "none"
    }

    private companion object {
        const val LOG_TEXT_SP = 11f
        const val MAX_SCREEN_LINES = 400
    }
}
