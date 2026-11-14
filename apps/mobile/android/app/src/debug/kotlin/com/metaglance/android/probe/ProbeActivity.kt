package com.metaglance.android.probe

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.ImageFormat
import android.graphics.Rect
import android.graphics.Typeface
import android.graphics.YuvImage
import android.os.Build
import android.os.Bundle
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.view.WindowManager
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.meta.wearable.dat.core.Wearables
import com.meta.wearable.dat.core.types.Permission
import com.metaglance.android.GlanceApp
import com.metaglance.android.dat.DatLink
import com.metaglance.android.mock.MockGlassesController
import com.metaglance.android.pipeline.QrScanner
import com.metaglance.core.image.I420
import com.metaglance.core.image.RawFrame
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull

/** The probe of step C1: one screen with buttons and a log. It is in the debug build only. */
class ProbeActivity : AppCompatActivity() {
    private lateinit var log: ProbeLog
    private lateinit var probeDir: File
    private lateinit var buttons: LinearLayout
    private lateinit var logView: TextView
    private lateinit var logScroll: ScrollView
    private lateinit var labelField: EditText

    private val glance: GlanceApp get() = application as GlanceApp
    private val datLink: DatLink get() = glance.datLink
    private val mock: MockGlassesController get() = glance.mockGlasses

    private var datPermission: Permission = Permission.CAMERA
    private var afterPhoneCamera: () -> Unit = {}
    private var qrJob: Job? = null

    private val bluetoothRequest = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        onBluetooth(granted)
    }
    private val datPermissionRequest = registerForActivityResult(Wearables.RequestPermissionContract()) { result ->
        datLink.onPermissionResult(datPermission, result)
    }
    private val phoneCameraRequest = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) afterPhoneCamera() else log.line("phone camera denied")
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        buildLayout()
        probeDir = getExternalFilesDir("probe") ?: File(filesDir, "probe")
        log = ProbeLog(probeDir)
        log.onLine = { text -> runOnUiThread { showLine(text) } }
        glance.datLog = log::line
        log.line("probe ready sdk=${Build.VERSION.SDK_INT} appId=${manifestAppId()}")
        addLinkButtons()
        // After a registration, Meta AI opens this activity again. The SDK must run before it gets the intent.
        if (mock.enabled || bluetoothGranted()) datLink.initialize(bluetoothGranted())
        datLink.handleIntent(this, intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        datLink.handleIntent(this, intent)
    }

    override fun onDestroy() {
        qrJob?.cancel()
        super.onDestroy()
    }

    fun addButton(label: String, onClick: () -> Unit): Button {
        val button = Button(this)
        button.text = label
        button.isAllCaps = false
        button.setOnClickListener { onClick() }
        buttons.addView(button, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
        return button
    }

    private fun addLinkButtons() {
        addButton("Bluetooth permission") {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                bluetoothRequest.launch(Manifest.permission.BLUETOOTH_CONNECT)
            } else {
                onBluetooth(true)
            }
        }
        addButton("Register") { datLink.register(this) }
        addButton("Camera permission") { requestDatPermission(Permission.CAMERA) }
        addButton("Mic permission") { requestDatPermission(Permission.MICROPHONE) }
        addButton("Start session") { datLink.startSession(withCamera = true) }
        addButton("Start session (no camera)") { datLink.startSession(withCamera = false) }
        addButton("Stop session") { datLink.stopSession() }
        addButton("Save frame") { saveFrame() }
        lateinit var qrButton: Button
        qrButton = addButton("QR log: off") {
            val on = toggleQrLog()
            qrButton.text = if (on) "QR log: on" else "QR log: off"
        }
        addButton("Mock: enable and pair") {
            mock.enable()
            datLink.initialize(bluetoothGranted())
            log.line(if (mock.pair()) "mock glasses paired" else "mock pairing failed")
        }
        addButton("Mock: phone camera") {
            withPhoneCamera {
                mock.usePhoneCamera()
                log.line("mock feed: phone camera")
            }
        }
        addButton("Mock: disable") {
            datLink.stopSession()
            mock.disable()
            log.line("mock disabled")
            datLink.initialize(bluetoothGranted())
        }
    }

    private fun onBluetooth(granted: Boolean) {
        log.line(if (granted) "bluetooth granted" else "bluetooth denied")
        datLink.initialize(granted)
    }

    private fun bluetoothGranted(): Boolean = Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
        ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED

    private fun requestDatPermission(permission: Permission) {
        datPermission = permission
        datPermissionRequest.launch(permission)
    }

    private fun withPhoneCamera(action: () -> Unit) {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            action()
        } else {
            afterPhoneCamera = action
            phoneCameraRequest.launch(Manifest.permission.CAMERA)
        }
    }

    private fun label(fallback: String): String = labelField.text.toString().trim().replace(Regex("[^A-Za-z0-9_-]"), "_").ifEmpty { fallback }

    private fun saveFrame() {
        val label = label("frame")
        lifecycleScope.launch {
            val frame = withTimeoutOrNull(FRAME_WAIT_MS) { datLink.frames.first() }
            if (frame == null) {
                log.line("save frame: no frame in $FRAME_WAIT_MS ms")
                return@launch
            }
            val file = withContext(Dispatchers.IO) { writeJpeg(frame, label) }
            log.line("saved ${file.parentFile?.name}/${file.name} ${frame.width}x${frame.height}")
        }
    }

    // The probe is the one part of the app that writes a frame to storage.
    private fun writeJpeg(frame: RawFrame, label: String): File {
        val dir = File(probeDir, "frames").apply { mkdirs() }
        val file = generateSequence(1) { it + 1 }
            .map { File(dir, "$label-${it.toString().padStart(2, '0')}.jpg") }
            .first { !it.exists() }
        val nv21 = I420.toNv21(frame.i420, frame.width, frame.height)
        file.outputStream().use { out ->
            YuvImage(nv21, ImageFormat.NV21, frame.width, frame.height, null)
                .compressToJpeg(Rect(0, 0, frame.width, frame.height), JPEG_QUALITY, out)
        }
        return file
    }

    private fun toggleQrLog(): Boolean {
        qrJob?.let {
            it.cancel()
            qrJob = null
            return false
        }
        qrJob = lifecycleScope.launch(Dispatchers.Default) {
            val scanner = QrScanner()
            var windowStartMs = 0L
            var linesInWindow = 0
            try {
                datLink.frames.collect { frame ->
                    val nv21 = I420.toNv21(frame.i420, frame.width, frame.height)
                    for (hit in scanner.scan(nv21, frame.width, frame.height)) {
                        val now = System.currentTimeMillis()
                        if (now - windowStartMs >= 1000) {
                            windowStartMs = now
                            linesInWindow = 0
                        }
                        if (linesInWindow < QR_LINES_PER_SECOND) {
                            linesInWindow += 1
                            log.line("qr \"${hit.text}\" area=${hit.areaPx}")
                        }
                    }
                }
            } finally {
                scanner.close()
            }
        }
        return true
    }

    private fun buildLayout() {
        buttons = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        labelField = EditText(this).apply {
            hint = "label for a frame or a recording"
            setSingleLine()
        }
        buttons.addView(labelField, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
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
        const val FRAME_WAIT_MS = 3000L
        const val JPEG_QUALITY = 95
        const val QR_LINES_PER_SECOND = 2
    }
}
