package com.metaglance.android.probe

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.ImageFormat
import android.graphics.Rect
import android.graphics.Typeface
import android.graphics.YuvImage
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.net.Uri
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
import com.meta.wearable.dat.inputs.types.InputSource
import com.meta.wearable.dat.mockdevice.api.MockGlasses
import com.meta.wearable.dat.motion.types.MotionSample
import com.meta.wearable.dat.motion.types.MotionSource
import com.meta.wearable.dat.motion.types.Vector3
import com.metaglance.android.GlanceApp
import com.metaglance.android.audio.ExoLinePlayer
import com.metaglance.android.audio.PhoneVoice
import com.metaglance.android.dat.DatLink
import com.metaglance.android.dat.ProbeDecisions
import com.metaglance.android.mock.MockGlassesController
import com.metaglance.android.pipeline.CodeScanner
import com.metaglance.android.pipeline.DigitReader
import com.metaglance.android.pipeline.FramePipeline
import com.metaglance.android.pipeline.regionBitmap
import com.metaglance.core.audio.PlayableLine
import com.metaglance.core.barcode.BarcodeRegion
import com.metaglance.core.barcode.Gtin
import com.metaglance.core.barcode.TextRows
import com.metaglance.core.contract.Lang
import com.metaglance.core.contract.SoundName
import com.metaglance.core.gesture.GyroSample
import com.metaglance.core.gesture.GyroScript
import com.metaglance.core.gesture.GyroStats
import com.metaglance.core.gesture.HeadGesture
import com.metaglance.core.gesture.HeadGestureConfig
import com.metaglance.core.gesture.HeadGestureDetector
import com.metaglance.core.gesture.MotionCsv
import com.metaglance.core.gesture.Sensitivity
import com.metaglance.core.image.I420
import com.metaglance.core.image.Pace
import com.metaglance.core.image.RawFrame
import com.metaglance.core.net.GlanceApi
import java.io.File
import java.io.FileWriter
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import okhttp3.OkHttpClient

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
    private var barcodeJob: Job? = null
    private var recordJob: Job? = null
    private var enduranceJob: Job? = null
    private var gestureJob: Job? = null
    private var pipelineJob: Job? = null
    private val voice: PhoneVoice by lazy { PhoneVoice(this) }
    private var linePlayer: ExoLinePlayer? = null

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
        // The speech engine of the phone needs time to start, so the probe creates it here.
        voice
        log.line("probe ready sdk=${Build.VERSION.SDK_INT} appId=${manifestAppId()}")
        addLinkButtons()
        addCapabilityButtons()
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
        barcodeJob?.cancel()
        recordJob?.cancel()
        enduranceJob?.cancel()
        gestureJob?.cancel()
        pipelineJob?.cancel()
        linePlayer?.release()
        voice.shutdown()
        log.onLine = {}
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
        lateinit var barcodeButton: Button
        barcodeButton = addButton("Barcode log: off") {
            val on = toggleBarcodeLog()
            barcodeButton.text = if (on) "Barcode log: on" else "Barcode log: off"
        }
        addButton("Mock: enable and pair") {
            mock.enable()
            datLink.initialize(bluetoothGranted())
            log.line(if (mock.pair()) "mock glasses paired" else "mock pairing failed")
        }
        addButton("Mock: enable, not registered") {
            datLink.stopSession()
            mock.enable(registered = false)
            datLink.initialize(bluetoothGranted())
            log.line(if (mock.pair()) "mock glasses paired, not registered" else "mock pairing failed")
        }
        addButton("Mock: deny camera") {
            mock.setCameraPermission(granted = false)
            log.line("mock camera permission: denied, and the next request gives denied")
            lifecycleScope.launch { datLink.refreshPermissions() }
        }
        addButton("Mock: phone camera") {
            withPhoneCamera {
                mock.usePhoneCamera()
                log.line("mock feed: phone camera")
            }
        }
        lateinit var placeholderButton: Button
        fun placeholderLabel() = if (glance.profileStore.usePlaceholder) "Use placeholder page: on" else "Use placeholder page: off"
        placeholderButton = addButton(placeholderLabel()) {
            glance.profileStore.usePlaceholder = !glance.profileStore.usePlaceholder
            placeholderButton.text = placeholderLabel()
            log.line("placeholder page ${if (glance.profileStore.usePlaceholder) "on" else "off"}. Close Glance and open it again.")
        }
        addButton("Mock: disable") {
            datLink.stopSession()
            mock.disable()
            log.line("mock disabled")
            datLink.initialize(bluetoothGranted())
        }
    }

    private fun addCapabilityButtons() {
        addButton("Motion") { datLink.attachMotion() }
        addButton("Inputs") { datLink.attachInputs(setOf(InputSource.CAPTOUCH)) }
        addButton("Speech") { datLink.attachSpeech() }
        addButton("Speak line") { speakLine() }
        addButton("Axis test") { axisTest() }
        lateinit var gestureButton: Button
        gestureButton = addButton("Gesture test: off") {
            val on = toggleGestureTest()
            gestureButton.text = if (on) "Gesture test: on" else "Gesture test: off"
        }
        addButton("Still") { lifecycleScope.launch { datLink.captureStill() } }
        lateinit var pipelineButton: Button
        pipelineButton = addButton("Pipeline test: off") {
            val on = togglePipelineTest()
            pipelineButton.text = if (on) "Pipeline test: on" else "Pipeline test: off"
        }
        addButton("Play test line") { playLine("/clip.wav") }
        addButton("Play bad clip") { playLine("/missing.mp3") }
        lateinit var recordButton: Button
        recordButton = addButton("Record motion: off") {
            val on = toggleMotionRecording()
            recordButton.text = if (on) "Record motion: on" else "Record motion: off"
        }
        lateinit var enduranceButton: Button
        enduranceButton = addButton("Endurance 10 min: off") {
            val on = toggleEndurance { enduranceButton.text = "Endurance 10 min: off" }
            enduranceButton.text = if (on) "Endurance 10 min: on" else "Endurance 10 min: off"
        }
        addButton("Mock: motion") {
            withMockGlasses { glasses ->
                val samples = List(MOCK_MOTION_SAMPLES) { i ->
                    MotionSample(i * MOCK_MOTION_STEP_NS, null, Vector3(1f, 0f, 0f), null, null, MotionSource.GLASSES)
                }
                glasses.services.motion.setMotionFeed(samples, true)
                log.line("mock motion feed: ${samples.size} samples with gyroscope x=1.0, in a loop")
            }
        }
        addButton("Mock: nod") {
            withMockGlasses { glasses ->
                val config = HeadGestureConfig.of(
                    Sensitivity.NORMAL,
                    ProbeDecisions.PITCH_AXIS,
                    ProbeDecisions.PITCH_DOWN_SIGN,
                    ProbeDecisions.YAW_AXIS
                )
                // 3 seconds of rest, one nod of 15 degrees, then rest: one nod each 4 seconds in a loop.
                val samples = GyroScript(config).rest(3000).pitch(0.26, 250).pitch(-0.26, 250).rest(500).samples().map {
                    MotionSample(it.tNs, null, Vector3(it.x, it.y, it.z), null, null, MotionSource.GLASSES)
                }
                glasses.services.motion.setMotionFeed(samples, true)
                log.line("mock motion feed: one nod each 4 seconds, ${samples.size} samples in a loop")
            }
        }
        addButton("Mock: double tap") { withMockGlasses { it.services.input.select(InputSource.CAPTOUCH) } }
        addButton("Mock: swipe") { withMockGlasses { it.services.input.navDown(InputSource.CAPTOUCH) } }
        addButton("Mock: say add") {
            withMockGlasses { it.services.speech.simulateTranscription("add", true, MOCK_CONFIDENCE) }
        }
        addButton("Mock: still image") {
            withMockGlasses { glasses ->
                val frame = File(probeDir, "frames").listFiles()?.maxByOrNull { it.lastModified() }
                if (frame == null) {
                    log.line("mock still image: save a frame first")
                } else {
                    glasses.services.camera.setCapturedImage(Uri.fromFile(frame))
                    log.line("mock still image: ${frame.name}")
                }
            }
        }
    }

    private fun withMockGlasses(action: (MockGlasses) -> Unit) {
        val glasses = mock.glasses
        if (glasses == null) log.line("mock: no mock glasses are paired") else action(glasses)
    }

    private fun speakLine() {
        val before = datLink.frameSize
        val outputs = getSystemService(AudioManager::class.java).getDevices(AudioManager.GET_DEVICES_OUTPUTS)
        log.line("speak line start frame=$before outputs=${outputs.joinToString(",") { outputName(it.type) }}")
        if (!voice.ready) log.line("speak line: the phone voice is not ready")
        voice.speak(PROBE_LINE) { log.line("speak line end frame before=$before after=${datLink.frameSize}") }
    }

    private fun outputName(type: Int): String = when (type) {
        AudioDeviceInfo.TYPE_BUILTIN_EARPIECE -> "BUILTIN_EARPIECE"
        AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> "BUILTIN_SPEAKER"
        AudioDeviceInfo.TYPE_BUILTIN_SPEAKER_SAFE -> "BUILTIN_SPEAKER_SAFE"
        AudioDeviceInfo.TYPE_WIRED_HEADSET -> "WIRED_HEADSET"
        AudioDeviceInfo.TYPE_WIRED_HEADPHONES -> "WIRED_HEADPHONES"
        AudioDeviceInfo.TYPE_BLUETOOTH_SCO -> "BLUETOOTH_SCO"
        AudioDeviceInfo.TYPE_BLUETOOTH_A2DP -> "BLUETOOTH_A2DP"
        AudioDeviceInfo.TYPE_BLE_HEADSET -> "BLE_HEADSET"
        AudioDeviceInfo.TYPE_BLE_SPEAKER -> "BLE_SPEAKER"
        AudioDeviceInfo.TYPE_HEARING_AID -> "HEARING_AID"
        AudioDeviceInfo.TYPE_USB_DEVICE -> "USB_DEVICE"
        AudioDeviceInfo.TYPE_USB_HEADSET -> "USB_HEADSET"
        AudioDeviceInfo.TYPE_TELEPHONY -> "TELEPHONY"
        else -> "TYPE_$type"
    }

    private fun axisTest() {
        log.line("axis test: move the head for ${AXIS_TEST_MS / 1000} seconds")
        lifecycleScope.launch {
            val samples = ArrayList<GyroSample>()
            withTimeoutOrNull(AXIS_TEST_MS) { datLink.gyro.collect { samples.add(it) } }
            val report = GyroStats.report(samples)
            log.line(
                "axis rms x=${report.rmsX} y=${report.rmsY} z=${report.rmsZ} " +
                    "strongest=${report.strongest} firstSign=${report.firstSign} samples=${samples.size}"
            )
        }
    }

    // The walk test counts each gesture with no head window, so each false nod and each false shake shows.
    private fun toggleGestureTest(): Boolean {
        gestureJob?.let {
            it.cancel()
            gestureJob = null
            return false
        }
        val config = HeadGestureConfig.of(
            Sensitivity.NORMAL,
            ProbeDecisions.PITCH_AXIS,
            ProbeDecisions.PITCH_DOWN_SIGN,
            ProbeDecisions.YAW_AXIS
        )
        gestureJob = lifecycleScope.launch {
            // The detector logs each stroke pair that it accepts or rejects, with the reason and the numbers.
            val detector = HeadGestureDetector(config) { log.line(it.line()) }
            var nods = 0
            var shakes = 0
            log.line("gesture test start pitch=${config.pitchAxis} down=${config.pitchDownSign} yaw=${config.yawAxis}")
            try {
                datLink.motionRows.collect { row ->
                    val gesture = detector.onSample(MotionCsv.head(listOf(row)).single()) ?: return@collect
                    if (gesture == HeadGesture.NOD) nods += 1 else shakes += 1
                    log.line("gesture $gesture nods=$nods shakes=$shakes")
                }
            } finally {
                log.line("gesture test end nods=$nods shakes=$shakes")
            }
        }
        return true
    }

    // Runs the frame path of the app with a gate that always passes. Nothing goes to a server.
    private fun togglePipelineTest(): Boolean {
        pipelineJob?.let {
            it.cancel()
            pipelineJob = null
            return false
        }
        pipelineJob = lifecycleScope.launch(Dispatchers.Default.limitedParallelism(1)) {
            val pipeline = FramePipeline(
                gate = { null },
                onKioskText = { text -> log.line("kiosk $text") },
                onUpload = { header, jpeg, _ -> log.line("upload seq=${header.seq} ${header.w}x${header.h} ${jpeg.size} bytes") },
                onBarcode = { read -> log.line("barcode ${read.code} ${read.source.name.lowercase()}") },
                onLabelStill = { log.line("label still wanted") },
                log = log::line
            )
            try {
                datLink.frames.collect { pipeline.onFrame(it) }
            } finally {
                pipeline.close()
            }
        }
        return true
    }

    // The fake server has /clip.wav and no /missing.mp3, so the second path shows the change to the phone voice.
    private fun playLine(path: String) {
        val serverUrl = glance.profileStore.serverUrl
        val player = linePlayer ?: ExoLinePlayer(this, voice, GlanceApi(OkHttpClient(), serverUrl)::clipUrl).also { linePlayer = it }
        log.line("line start $serverUrl$path")
        player.play(PlayableLine("t", SoundName.FOUND, serverUrl + path, "Test line.", Lang.EN, 1.0, false)) { log.line("line ended") }
    }

    private fun toggleMotionRecording(): Boolean {
        recordJob?.let {
            it.cancel()
            recordJob = null
            return false
        }
        val file = File(File(probeDir, "motion").apply { mkdirs() }, "${label("motion")}.csv")
        recordJob = lifecycleScope.launch(Dispatchers.IO) {
            var rows = 0
            log.line("record motion start motion/${file.name}")
            try {
                FileWriter(file, true).buffered().use { out ->
                    datLink.motionRows.collect { row ->
                        out.write(MotionCsv.format(row))
                        out.newLine()
                        rows += 1
                    }
                }
            } finally {
                log.line("record motion end motion/${file.name} rows=$rows")
            }
        }
        return true
    }

    private fun toggleEndurance(onEnd: () -> Unit): Boolean {
        enduranceJob?.let {
            it.cancel()
            enduranceJob = null
            log.line("endurance stopped")
            return false
        }
        enduranceJob = lifecycleScope.launch {
            log.line("endurance start")
            for (halfMinute in 1..ENDURANCE_HALF_MINUTES) {
                voice.speak(PROBE_LINE) {}
                delay(HALF_MINUTE_MS)
                if (halfMinute % 2 == 0) {
                    val device = datLink.snapshot.value.device
                    log.line(
                        "endurance min=${halfMinute / 2} battery=${device?.battery} thermal=${device?.thermal} " +
                            "frames=${datLink.frameCount} frame=${datLink.frameSize} motion=${datLink.motionSampleCount}"
                    )
                }
            }
            log.line("endurance end")
            enduranceJob = null
            onEnd()
        }
        return true
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
            val scanner = CodeScanner()
            var windowStartMs = 0L
            var linesInWindow = 0
            try {
                datLink.frames.collect { frame ->
                    val nv21 = I420.toNv21(frame.i420, frame.width, frame.height)
                    for (hit in scanner.scan(nv21, frame.width, frame.height)) {
                        val text = hit.text
                        if (!hit.isQr || text == null) continue
                        val now = System.currentTimeMillis()
                        if (now - windowStartMs >= 1000) {
                            windowStartMs = now
                            linesInWindow = 0
                        }
                        if (linesInWindow < QR_LINES_PER_SECOND) {
                            linesInWindow += 1
                            log.line("qr \"$text\" area=${hit.areaPx}")
                        }
                    }
                }
            } finally {
                scanner.close()
            }
        }
        return true
    }

    // Logs what the scanner and OCR read of a product barcode. With it a person finds the distance at which
    // a code decodes from the stream of the glasses. Each kind of line comes 2 times each second at most.
    private fun toggleBarcodeLog(): Boolean {
        barcodeJob?.let {
            it.cancel()
            barcodeJob = null
            return false
        }
        barcodeJob = lifecycleScope.launch(Dispatchers.Default) {
            val scanner = CodeScanner()
            val digits = DigitReader()
            val codeLines = Pace(BARCODE_LINE_MS)
            val regionLines = Pace(BARCODE_LINE_MS)
            val digitReads = Pace(BARCODE_LINE_MS)
            try {
                datLink.frames.collect { frame ->
                    val now = System.currentTimeMillis()
                    val size = "${frame.width}x${frame.height}"
                    val hits = scanner.scan(I420.toNv21(frame.i420, frame.width, frame.height), frame.width, frame.height).filterNot { it.isQr }
                    for (hit in hits) {
                        val box = hit.box ?: continue
                        val text = hit.text
                        if (text == null) {
                            if (regionLines.tryRun(now)) log.line("barcode region ${box.width}x${box.height} at ${box.left},${box.top} frame=$size")
                        } else if (codeLines.tryRun(now)) {
                            log.line("barcode ${hit.formatName} \"$text\" valid=${hit.productCode != null} width=${box.width} frame=$size")
                        }
                    }
                    // The digits under the largest code, also when the bars decode, so both ways show their range.
                    val region = BarcodeRegion.largest(hits.mapNotNull { it.box }) ?: return@collect
                    val crop = BarcodeRegion.forDigits(region, frame.width, frame.height) ?: return@collect
                    if (!digitReads.tryRun(now)) return@collect
                    val bitmap = frame.regionBitmap(crop)
                    val rows = TextRows.rows(digits.read(bitmap))
                    bitmap.recycle()
                    for (row in rows.filter { words -> words.any { word -> word.any(Char::isDigit) } }) {
                        log.line("barcode digits \"${row.joinToString(" ")}\" codes=${Gtin.digitRuns(row)} crop=${crop.width}x${crop.height}")
                    }
                }
            } finally {
                scanner.close()
                digits.close()
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
        const val BARCODE_LINE_MS = 500L
        const val PROBE_LINE = "Oat drink, one litre, one eighty-nine. Nod to add."
        const val AXIS_TEST_MS = 4000L
        const val HALF_MINUTE_MS = 30_000L
        const val ENDURANCE_HALF_MINUTES = 20
        const val MOCK_MOTION_SAMPLES = 60
        const val MOCK_MOTION_STEP_NS = 33_333_333L
        const val MOCK_CONFIDENCE = 0.9f
    }
}
