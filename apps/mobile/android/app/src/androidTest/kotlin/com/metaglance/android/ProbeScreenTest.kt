package com.metaglance.android

import android.content.Context
import android.graphics.BitmapFactory
import android.graphics.Color
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.test.ext.junit.rules.ActivityScenarioRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.metaglance.android.probe.ProbeActivity
import com.metaglance.android.support.TestClips
import com.metaglance.android.support.TestStreamRule
import com.metaglance.android.support.assetUri
import com.metaglance.android.support.onMainSync
import com.metaglance.android.support.requireSilentPhone
import com.metaglance.android.support.waitFor
import com.metaglance.android.support.waitUntil
import com.metaglance.core.state.DatPermission
import java.io.File
import java.time.Duration
import java.time.LocalTime
import kotlinx.coroutines.launch
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The probe screen with mock glasses: the MockDeviceKit checks of Plan 2 Task 1 Step 7, Task 2 Step 6,
 * Task 3 Step 6, and Task 14 Step 4. Each test taps the buttons of the screen and reads its log.
 *
 * The mock camera plays a video file, because nobody points the phone camera at night. A check that needs
 * ears is not here: the phone is silent, so the tests see only that a line ends.
 */
@RunWith(AndroidJUnit4::class)
class ProbeScreenTest {
    @get:Rule
    val scenarioRule = ActivityScenarioRule(ProbeActivity::class.java)

    @get:Rule
    val testStream = TestStreamRule()

    private lateinit var targetContext: Context

    private val glance: GlanceApp get() = targetContext.applicationContext as GlanceApp

    @Before
    fun setUp() {
        targetContext = InstrumentationRegistry.getInstrumentation().targetContext
        requireSilentPhone(targetContext)
    }

    @After
    fun tearDown() {
        // The button stops a session and restores the real layers of the SDK. Without Bluetooth the SDK does not start.
        tap("Mock: disable")
        awaitLine("mock disabled")
    }

    @Test
    fun theProbeLogsItsStartLine() {
        awaitLine(Regex("""probe ready sdk=\d+ appId=0"""))
    }

    @Test
    fun aMockSessionStreamsStopsAndStartsAgain() {
        pairWithFeed(TestClips.SCENE)
        tap("Start session")
        awaitLine("session STARTED")
        awaitLine("stream STREAMING")
        awaitLine(Regex("""frame ${TestClips.FRAME_SIZE} #\d+ fps=\d+\.\d"""))

        // Check 4 of Task 2 asks a person for "natural colors". The saved frame must show the boxes of the scene.
        setLabel("colors")
        tap("Save frame")
        val saved = awaitLine(Regex("""saved frames/(colors-\d+\.jpg) ${TestClips.FRAME_SIZE}"""))
        val file = File(probeDir(), "frames/${saved.groupValues[1]}")
        val bitmap = checkNotNull(BitmapFactory.decodeFile(file.path)) { "The saved frame ${file.path} does not decode." }
        assertColor("red box", bitmap.getPixel(180, 360)) { r, g, b -> r > 150 && g < 90 && b < 90 }
        assertColor("green box", bitmap.getPixel(540, 360)) { r, g, b -> g > 110 && r < 90 && b < 110 }
        assertColor("blue box", bitmap.getPixel(180, 920)) { r, g, b -> b > 150 && r < 90 && g < 120 }

        tap("Stop session")
        awaitLine("session STOPPED")
        tap("Start session")
        waitUntil("a second stream reaches STREAMING", STEP_MS, ::logTail) { lines().count { it.endsWith(" stream STREAMING") } == 2 }
    }

    @Test
    fun theScannerAndThePipelineReadTheKioskCode() {
        pairWithFeed(TestClips.KIOSK)
        tap("Start session")
        awaitLine("stream STREAMING")

        tap("QR log")
        awaitLine(Regex("""qr "${TestClips.KIOSK_TEXT}" area=\d+"""))
        tap("QR log")

        tap("Pipeline test")
        waitUntil("the pipeline logs 5 uploads and 3 kiosk lines", PIPELINE_MS, ::logTail) {
            lines().count { UPLOAD_LINE.containsMatchIn(it) } >= 5 && lines().count { it.endsWith(" kiosk ${TestClips.KIOSK_TEXT}") } >= 3
        }
        tap("Pipeline test")

        val uploads = lines().mapNotNull { UPLOAD_LINE.find(it) }
        for (upload in uploads) {
            val (seq, width, height, bytes) = upload.destructured
            assertTrue("upload $seq is ${width}x$height", maxOf(width.toInt(), height.toInt()) <= MAX_LONG_SIDE)
            assertTrue("upload $seq has $bytes bytes", bytes.toInt() < MAX_JPEG_BYTES)
        }
        // The pipeline sends the sharpest frame of each 300 ms, and it reports a code in view one time each second.
        assertGap("uploads", lines().filter { UPLOAD_LINE.containsMatchIn(it) }, 180, 540)
        assertGap("kiosk lines", lines().filter { it.endsWith(" kiosk ${TestClips.KIOSK_TEXT}") }, 700, 1500)
    }

    @Test
    fun theBarcodeLogAndThePipelineReadAProductCode() {
        pairWithFeed(TestClips.BARCODE)
        tap("Start session")
        awaitLine("stream STREAMING")

        tap("Barcode log")
        val decoded = awaitLine(Regex("""barcode EAN_13 "${TestClips.BARCODE_TEXT}" valid=true width=(\d+) frame=${TestClips.FRAME_SIZE}"""))
        // The clip has 5 pixels for each of the 95 narrow bars of the code.
        assertTrue("width ${decoded.groupValues[1]}", decoded.groupValues[1].toInt() in 400..560)
        // OCR can read a digit wrong: on the test phone it read 4008381333931 here. The check digit then gives no code.
        val digits = awaitLine(Regex("""barcode digits ".*\d.*" codes=\[(.*)] crop=\d+x\d+"""))
        assertTrue("codes ${digits.groupValues[1]}", digits.groupValues[1] in setOf("", TestClips.BARCODE_TEXT))
        tap("Barcode log")

        val read = "barcode read ${TestClips.BARCODE_TEXT} barcode"
        val report = "barcode ${TestClips.BARCODE_TEXT} barcode"
        tap("Pipeline test")
        waitUntil("the pipeline logs 3 reports of the code", PIPELINE_MS, ::logTail) { lines().count { it.endsWith(" $report") } >= 3 }
        tap("Pipeline test")

        // The agreement rule: the first report comes with the second equal read, and not before it.
        val texts = lines().map { it.substringAfter(' ') }
        assertEquals(2, texts.take(texts.indexOf(report)).count { it == read })
        // A code in view is reported one time each second, and the mock stream has 30 frames each second.
        assertGap("barcode reports", lines().filter { it.endsWith(" $report") }, 700, 1500)
    }

    @Test
    fun motionInputsSpeechAndTheStillWork() {
        pairWithFeed(TestClips.SCENE)
        tap("Start session")
        awaitLine("stream STREAMING")

        tap("Motion")
        awaitLine("motion STARTED")
        tap("Mock: motion")
        tap("Axis test")
        awaitLine(Regex("""axis rms .* strongest=X firstSign=1 samples=\d+"""))

        tap("Inputs")
        awaitLine("inputs ACTIVE")
        tap("Mock: double tap")
        awaitLine("touch DOUBLE_TAP")
        tap("Mock: swipe")
        awaitLine("touch SWIPE")

        // The button "Mic permission" opens the permission screen of the SDK. The test reads the status in its place.
        glance.scope.launch { glance.datLink.refreshPermissions() }
        waitUntil("the microphone permission of the mock is granted", STEP_MS, ::logTail) {
            glance.datLink.snapshot.value.microphonePermission == DatPermission.GRANTED
        }
        tap("Speech")
        awaitLine(Regex("""speech STARTED.*"""))
        tap("Mock: say add")
        awaitLine("transcript \"add\" final 0.9")

        tap("Speak line")
        awaitLine("speak line end frame before=${TestClips.FRAME_SIZE} after=${TestClips.FRAME_SIZE}", SPEAK_MS)

        val image = assetUri(TestClips.SCENE_IMAGE)
        onMainSync { checkNotNull(glance.mockGlasses.glasses).services.camera.setCapturedImage(image) }
        tap("Still")
        awaitLine(Regex("""still 720x1280 (Bitmap|HEIC) \d+ ms"""))

        val label = "rows${System.currentTimeMillis()}"
        setLabel(label)
        tap("Record motion")
        Thread.sleep(RECORD_MS)
        tap("Record motion")
        val recorded = awaitLine(Regex("""record motion end motion/$label\.csv rows=(\d+)"""))
        assertTrue("rows: ${recorded.groupValues[1]}", recorded.groupValues[1].toInt() > 0)
        val file = File(probeDir(), "motion/$label.csv")
        val rows = file.readLines().filter { it.isNotBlank() }
        assertTrue("The file has ${rows.size} rows.", rows.isNotEmpty())
        for (row in rows) assertEquals(row, MOTION_COLUMNS, row.split(",").size)
        file.delete()
    }

    @Test
    fun aClipThatDoesNotLoadStillEndsItsLine() {
        tap("Play bad clip")
        awaitLine("line ended", SPEAK_MS)
    }

    private fun pairWithFeed(clip: String) {
        tap("Mock: enable and pair")
        awaitLine("registration REGISTERED")
        awaitLine("mock glasses paired")
        awaitLine(Regex("""device .* link=CONNECTED .* don=DONNED hinge=OPEN .*"""))
        val uri = assetUri(clip)
        onMainSync { checkNotNull(glance.mockGlasses.glasses).services.camera.setCameraFeed(uri) }
    }

    /** Taps the button whose label starts with `label`. A switch shows its state after its name. */
    private fun tap(label: String) {
        scenarioRule.scenario.onActivity { activity ->
            val button = views(activity.findViewById(android.R.id.content)).filterIsInstance<Button>().firstOrNull { it.text.startsWith(label) }
            checkNotNull(button) { "The probe has no button \"$label\"." }.performClick()
        }
    }

    private fun setLabel(text: String) {
        scenarioRule.scenario.onActivity { activity ->
            views(activity.findViewById(android.R.id.content)).filterIsInstance<EditText>().first().setText(text)
        }
    }

    /** The lines of the log on the screen, each with its time. */
    private fun lines(): List<String> {
        var text = ""
        scenarioRule.scenario.onActivity { activity ->
            val log = views(activity.findViewById(android.R.id.content)).first { it is TextView && it !is Button && it !is EditText } as TextView
            text = log.text.toString()
        }
        return text.lines().filter { it.isNotEmpty() }
    }

    private fun logTail(): String = lines().takeLast(LOG_TAIL).joinToString(" | ")

    private fun awaitLine(message: String, timeoutMs: Long = STEP_MS) {
        waitUntil("the log line \"$message\"", timeoutMs, ::logTail) { lines().any { it.substringAfter(' ') == message } }
    }

    private fun awaitLine(pattern: Regex, timeoutMs: Long = STEP_MS): MatchResult = waitFor("a log line like ${pattern.pattern}", timeoutMs, ::logTail) {
        lines().firstNotNullOfOrNull { pattern.matchEntire(it.substringAfter(' ')) }
    }

    private fun views(root: View): List<View> = if (root is ViewGroup) {
        listOf(root) + (0 until root.childCount).flatMap { views(root.getChildAt(it)) }
    } else {
        listOf(root)
    }

    private fun probeDir(): File = targetContext.getExternalFilesDir("probe") ?: File(targetContext.filesDir, "probe")

    private fun assertColor(name: String, pixel: Int, expected: (Int, Int, Int) -> Boolean) {
        val r = Color.red(pixel)
        val g = Color.green(pixel)
        val b = Color.blue(pixel)
        assertTrue("$name is rgb($r, $g, $b)", expected(r, g, b))
    }

    /** Checks the mean time between log lines. Each line starts with its time as `HH:mm:ss.SSS`. */
    private fun assertGap(name: String, lines: List<String>, minMs: Long, maxMs: Long) {
        val times = lines.map { LocalTime.parse(it.substringBefore(' ')) }
        val meanMs = Duration.between(times.first(), times.last()).toMillis() / (times.size - 1)
        assertTrue("The mean time between $name is $meanMs ms.", meanMs in minMs..maxMs)
    }

    private companion object {
        const val STEP_MS = 10_000L
        const val SPEAK_MS = 25_000L
        const val PIPELINE_MS = 15_000L
        const val RECORD_MS = 3_000L
        const val LOG_TAIL = 15
        const val MAX_LONG_SIDE = 768
        const val MAX_JPEG_BYTES = 200_000
        const val MOTION_COLUMNS = 14
        val UPLOAD_LINE = Regex("""upload seq=(\d+) (\d+)x(\d+) (\d+) bytes""")
    }
}
