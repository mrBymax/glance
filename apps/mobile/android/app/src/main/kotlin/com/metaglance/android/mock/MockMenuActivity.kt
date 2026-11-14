package com.metaglance.android.mock

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.text.InputType
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.meta.wearable.dat.core.types.ThermalLevel
import com.meta.wearable.dat.inputs.types.InputSource
import com.meta.wearable.dat.mockdevice.api.MockGlasses
import com.metaglance.android.GlanceApp
import com.metaglance.android.dat.DatLink
import com.metaglance.android.dat.ProbeDecisions
import com.metaglance.android.session.SessionController
import com.metaglance.core.barcode.LabelTiming
import com.metaglance.core.barcode.MsField
import com.metaglance.core.contract.DeviceState
import com.metaglance.core.contract.GlanceJson
import com.metaglance.core.contract.NativeState
import com.metaglance.core.gesture.GyroScript
import com.metaglance.core.gesture.HeadGestureConfig
import com.metaglance.core.gesture.Sensitivity
import com.metaglance.core.state.DatCompatibility
import com.metaglance.core.state.DatFault
import com.metaglance.core.state.DatSession
import com.metaglance.core.state.StateMapper
import java.io.File
import java.io.IOException
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull

/**
 * The mock menu "Glance Mock": one button for each state that the app can reach without glasses.
 * It drives MockDeviceKit, and it has force items for the states that MockDeviceKit cannot make.
 * It is in each build type, because mock mode is the fallback of the live demo.
 */
class MockMenuActivity : AppCompatActivity() {
    private lateinit var stateView: TextView
    private lateinit var statusView: TextView
    private lateinit var items: LinearLayout
    private lateinit var serverField: EditText

    private val glance: GlanceApp get() = application as GlanceApp
    private val dat: DatLink get() = glance.datLink
    private val mock: MockGlassesController get() = glance.mockGlasses
    private val session: SessionController get() = glance.session

    private val phoneCameraRequest = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) {
            mock.usePhoneCamera()
            status("Camera feed: phone camera")
        } else {
            status("The camera permission of the phone is denied.")
        }
    }
    private val stillPicker = registerForActivityResult(ActivityResultContracts.GetContent()) { picked ->
        val file = picked?.let { copyToCache(it, "mock-still") } ?: return@registerForActivityResult
        withGlasses("Still image: ${file.name}") { it.services.camera.setCapturedImage(Uri.fromFile(file)) }
    }
    private val motionPicker = registerForActivityResult(ActivityResultContracts.GetContent()) { picked ->
        val file = picked?.let { copyToCache(it, "mock-motion.csv") } ?: return@registerForActivityResult
        status(if (mock.replayMotionFile(Uri.fromFile(file))) "Motion: ${file.name}" else NO_GLASSES)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        buildLayout()
        addItems()
        lifecycleScope.launch {
            combine(session.nativeState, dat.snapshot) { native, snapshot -> native to StateMapper.deviceState(snapshot) }
                .collect { (native, device) -> showState(native, device) }
        }
    }

    private fun addItems() {
        group("Mode")
        item("Enable (registered)") { setMode("Mock mode on, registered") { mock.enable(registered = true) } }
        item("Enable (not registered)") { setMode("Mock mode on, not registered") { mock.enable(registered = false) } }
        item("Disable") { setMode("Mock mode off") { mock.disable() } }

        group("Glasses")
        item("Pair") { status(if (mock.pair()) "Mock glasses paired" else "The pairing failed. Enable mock mode first.") }
        item("Power on") { withGlasses("Power on") { it.powerOn() } }
        item("Power off") { withGlasses("Power off") { it.powerOff() } }
        item("Don") { withGlasses("Don") { it.don() } }
        item("Doff") { withGlasses("Doff") { it.doff() } }
        item("Fold") { withGlasses("Fold") { it.fold() } }
        item("Unfold") { withGlasses("Unfold") { it.unfold() } }

        group("Camera")
        item("Phone camera") { phoneCameraRequest.launch(Manifest.permission.CAMERA) }
        item("Still image") { stillPicker.launch("image/*") }

        group("State")
        for (level in listOf(100, 20, 10, 3)) {
            item("Battery $level") { withGlasses("Battery $level") { it.setBatteryLevel(level) } }
        }
        item("Thermal none") { withGlasses("Thermal none") { it.setThermalLevel(ThermalLevel.NONE) } }
        item("Thermal severe") { withGlasses("Thermal severe") { it.setThermalLevel(ThermalLevel.SEVERE) } }
        item("Thermal critical") { withGlasses("Thermal critical") { it.setThermalLevel(ThermalLevel.CRITICAL) } }

        group("Touchpad")
        item("Tap") { withGlasses("Tap") { it.services.captouch.tap() } }
        item("Tap and hold") { withGlasses("Tap and hold") { it.services.captouch.tapAndHold() } }
        item("Double tap") { withGlasses("Double tap") { it.services.input.select(InputSource.CAPTOUCH) } }
        item("Swipe") { withGlasses("Swipe") { it.services.input.navDown(InputSource.CAPTOUCH) } }

        group("Registration")
        item("Next registration fails") { ifEnabled("The next registration fails") { mock.setNextRegistration(works = false) } }
        item("Next registration works") { ifEnabled("The next registration works") { mock.setNextRegistration(works = true) } }
        item("Camera: deny") { setCameraPermission(granted = false) }
        item("Camera: allow") { setCameraPermission(granted = true) }

        group("Motion")
        item("Replay nod") {
            replay("Nod") { rest(REST_MS).pitch(NOD_RAD, STROKE_MS).pitch(-NOD_RAD, STROKE_MS).rest(REST_MS) }
        }
        item("Replay shake") {
            replay("Shake") {
                rest(REST_MS).yaw(SHAKE_RAD / 2, SHAKE_STROKE_MS).yaw(-SHAKE_RAD, SHAKE_STROKE_MS)
                    .yaw(SHAKE_RAD, SHAKE_STROKE_MS).yaw(-SHAKE_RAD / 2, SHAKE_STROKE_MS).rest(REST_MS)
            }
        }
        item("Replay CSV file") { motionPicker.launch("*/*") }
        lateinit var record: Button
        fun recordLabel() = "Record motion in sessions: " + if (glance.profileStore.recordMotion) "on" else "off"
        record = item(recordLabel()) {
            glance.profileStore.recordMotion = !glance.profileStore.recordMotion
            record.text = recordLabel()
            status(if (glance.profileStore.recordMotion) "Each head window writes a file to probe/motion, from the next prompt." else "Sessions record no motion.")
        }

        group("Speech")
        item("Say add") { status(if (mock.say("add")) "Said: add" else NO_GLASSES) }
        item("Say skip") { status(if (mock.say("skip")) "Said: skip" else NO_GLASSES) }

        group("Force")
        item("Meta AI missing") { force("Meta AI missing") { dat.debugOverride(metaAiInstalled = false) } }
        item("Update required") {
            force("Update required") { dat.debugOverride(compatibility = DatCompatibility.DEVICE_UPDATE_REQUIRED) }
        }
        item("Stream error BATTERY_LOW") {
            force("Stream error BATTERY_LOW") { dat.debugFault(DatFault(DatFault.Area.STREAM, "BATTERY_LOW")) }
        }
        item("Stream error THERMAL_HOT") {
            force("Stream error THERMAL_HOT") { dat.debugFault(DatFault(DatFault.Area.STREAM, "THERMAL_HOT")) }
        }

        group("App")
        addServerField()
        item("Drop server link 10 s") {
            session.debugDropSocket(DROP_MS)
            status("The server link is closed for 10 seconds.")
        }
        for (level in Sensitivity.entries) {
            val name = level.name.lowercase()
            item("Sensitivity: $name") {
                glance.profileStore.sensitivity = level
                session.applySensitivity()
                status("Sensitivity: $name")
            }
        }
        lateinit var placeholder: Button
        fun placeholderLabel() = "Use placeholder page: " + if (glance.profileStore.usePlaceholder) "on" else "off"
        placeholder = item(placeholderLabel()) {
            glance.profileStore.usePlaceholder = !glance.profileStore.usePlaceholder
            placeholder.text = placeholderLabel()
            status("Close Glance and open it again.")
        }

        group("Barcode")
        addBarcodeFields()
    }

    /** Each change of mode stops a running session first, and waits for its end. */
    private fun setMode(done: String, change: () -> Unit) {
        lifecycleScope.launch {
            session.stopCamera()
            dat.stopSession()
            val stopped = withTimeoutOrNull(STOP_WAIT_MS) {
                dat.snapshot.first { it.session == DatSession.NONE || it.session == DatSession.STOPPED }
            }
            if (stopped == null) status("The session did not stop in time.")
            change()
            dat.debugClearOverrides()
            dat.initialize(bluetoothGranted())
            if (dat.ready) dat.refreshPermissions()
            status(done)
        }
    }

    private fun setCameraPermission(granted: Boolean) {
        if (!mock.enabled) {
            status(NOT_ENABLED)
            return
        }
        mock.setCameraPermission(granted)
        // The SDK reports a permission only when the app asks for it.
        lifecycleScope.launch {
            dat.refreshPermissions()
            status(if (granted) "Camera permission: granted" else "Camera permission: denied")
        }
    }

    private fun replay(done: String, build: GyroScript.() -> GyroScript) {
        val config = HeadGestureConfig.of(glance.profileStore.sensitivity, ProbeDecisions.PITCH_AXIS, ProbeDecisions.PITCH_DOWN_SIGN, ProbeDecisions.YAW_AXIS)
        status(if (mock.replayMotion(GyroScript(config).build().samples())) done else NO_GLASSES)
    }

    private fun withGlasses(done: String, action: (MockGlasses) -> Unit) {
        val glasses = mock.glasses
        if (glasses == null) {
            status(NO_GLASSES)
            return
        }
        action(glasses)
        status(done)
    }

    private fun ifEnabled(done: String, action: () -> Unit) {
        if (!mock.enabled) {
            status(NOT_ENABLED)
            return
        }
        action()
        status(done)
    }

    private fun force(done: String, action: () -> Unit) {
        action()
        status("Forced: $done")
    }

    private fun copyToCache(source: Uri, name: String): File? = try {
        val file = File(cacheDir, name)
        contentResolver.openInputStream(source)?.use { input -> file.outputStream().use { input.copyTo(it) } }
        file.takeIf { it.length() > 0 }
    } catch (e: IOException) {
        status("The file did not open: ${e.message}")
        null
    }

    private fun bluetoothGranted(): Boolean = Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
        ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED

    private fun showState(native: NativeState, device: DeviceState) {
        stateView.text = buildString {
            append("NativeState ")
            append(GlanceJson.encodeToString(NativeState.serializer(), native))
            append("\nDeviceState ")
            append(GlanceJson.encodeToString(DeviceState.serializer(), device))
        }
    }

    private fun status(text: String) {
        statusView.text = text
    }

    private fun group(title: String) {
        val view = TextView(this)
        view.text = title
        view.setTypeface(view.typeface, Typeface.BOLD)
        view.setPadding(0, dp(GROUP_GAP_DP), 0, 0)
        items.addView(view, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
    }

    private fun item(label: String, onClick: () -> Unit): Button {
        val button = Button(this)
        button.text = label
        button.isAllCaps = false
        button.setOnClickListener { onClick() }
        items.addView(button, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
        return button
    }

    private fun addServerField() {
        serverField = EditText(this)
        serverField.hint = "Server URL"
        serverField.inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
        serverField.isSingleLine = true
        serverField.setText(glance.profileStore.serverUrl)
        items.addView(serverField, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
        item("Save server URL") {
            glance.profileStore.serverUrl = serverField.text.toString()
            // An empty field gives the address of the build again.
            serverField.setText(glance.profileStore.serverUrl)
            status("Server URL: ${glance.profileStore.serverUrl}")
        }
    }

    /**
     * The two times of the label still. They count for mock glasses and for real glasses, from the next camera start.
     * An empty field gives the value of the build again, and a number outside the limits becomes the nearest limit.
     */
    private fun addBarcodeFields() {
        val store = glance.profileStore
        val waitField = msField("Barcode wait (ms)", store.labelTiming.waitMs)
        val gapField = msField("Still gap (ms)", store.labelTiming.gapMs)
        item("Save barcode waits") {
            val wait = LabelTiming.readField(waitField.text.toString(), LabelTiming.WAIT_LIMITS_MS)
            val gap = LabelTiming.readField(gapField.text.toString(), LabelTiming.GAP_LIMITS_MS)
            if (wait is MsField.NotANumber || gap is MsField.NotANumber) {
                status("Type a whole number of milliseconds, or leave the field empty.")
                return@item
            }
            store.labelWaitMs = (wait as? MsField.Value)?.ms
            store.labelGapMs = (gap as? MsField.Value)?.ms
            val saved = store.labelTiming
            waitField.setText(saved.waitMs.toString())
            gapField.setText(saved.gapMs.toString())
            status("Barcode wait: ${saved.waitMs} ms. Still gap: ${saved.gapMs} ms. The next camera start uses them.")
        }
    }

    private fun msField(label: String, valueMs: Long): EditText {
        val caption = TextView(this)
        caption.text = label
        items.addView(caption, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
        val field = EditText(this)
        field.hint = label
        field.inputType = InputType.TYPE_CLASS_NUMBER
        field.isSingleLine = true
        field.setText(valueMs.toString())
        items.addView(field, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
        return field
    }

    private fun buildLayout() {
        val pad = dp(PAD_DP)
        val root = LinearLayout(this)
        root.orientation = LinearLayout.VERTICAL
        root.fitsSystemWindows = true
        root.setPadding(pad, pad, pad, pad)

        stateView = TextView(this)
        stateView.typeface = Typeface.MONOSPACE
        stateView.textSize = STATE_TEXT_SP
        stateView.setTextIsSelectable(true)
        val stateScroll = ScrollView(this)
        stateScroll.addView(stateView)
        root.addView(stateScroll, LinearLayout.LayoutParams(MATCH_PARENT, dp(STATE_HEIGHT_DP)))

        statusView = TextView(this)
        statusView.text = if (mock.enabled) "Mock mode is on." else "Mock mode is off."
        statusView.setPadding(0, pad, 0, pad)
        root.addView(statusView, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))

        items = LinearLayout(this)
        items.orientation = LinearLayout.VERTICAL
        val scroll = ScrollView(this)
        scroll.addView(items)
        root.addView(scroll, LinearLayout.LayoutParams(MATCH_PARENT, 0, 1f))
        setContentView(root)
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private companion object {
        const val NO_GLASSES = "No mock glasses are paired. Tap Pair first."
        const val NOT_ENABLED = "Mock mode is off. Tap Enable first."
        const val PAD_DP = 12
        const val GROUP_GAP_DP = 16
        const val STATE_HEIGHT_DP = 150
        const val STATE_TEXT_SP = 11f
        const val STOP_WAIT_MS = 5000L
        const val DROP_MS = 10_000L
        const val REST_MS = 600
        const val STROKE_MS = 250

        /** 15 degrees down and back. */
        const val NOD_RAD = 0.26

        /** 20 degrees from side to side. */
        const val SHAKE_RAD = 0.35
        const val SHAKE_STROKE_MS = 200
    }
}
