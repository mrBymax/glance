package com.metaglance.android.support

import android.app.Activity
import android.content.Context
import androidx.test.ext.junit.rules.ActivityScenarioRule
import androidx.test.platform.app.InstrumentationRegistry
import com.meta.wearable.dat.mockdevice.MockDeviceKit
import com.meta.wearable.dat.mockdevice.api.MockDeviceKitInterface
import com.meta.wearable.dat.mockdevice.api.MockGlasses
import com.meta.wearable.dat.motion.types.MotionSample
import com.meta.wearable.dat.motion.types.MotionSource
import com.meta.wearable.dat.motion.types.Vector3
import com.metaglance.android.GlanceApp
import com.metaglance.android.dat.ProbeDecisions
import com.metaglance.core.gesture.GyroSample
import com.metaglance.core.gesture.GyroScript
import com.metaglance.core.gesture.HeadGestureConfig
import com.metaglance.core.gesture.Sensitivity
import com.metaglance.core.state.DatLinkState
import com.metaglance.core.state.DatRegistration
import com.metaglance.core.state.DatSession
import java.util.concurrent.CopyOnWriteArrayList
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule

/**
 * The base class of each test with mock glasses. It follows the DAT guide "Android testing with Mock Device Kit":
 * https://wearables.developer.meta.com/docs/develop/dat/testing-mdk-android
 *
 * Two parts differ from the guide. The test uses the `MockGlassesController` and the `DatLink` of the app, so
 * that the app sees the mock glasses. And no test grants `BLUETOOTH_CONNECT`: MockDeviceKit does not use
 * Bluetooth, and without the permission the app never starts the real SDK on the test phone.
 */
abstract class MockDeviceKitTestCase<T : Activity>(activityClass: Class<T>) {
    @get:Rule
    val scenarioRule = ActivityScenarioRule(activityClass)

    protected lateinit var mockDeviceKit: MockDeviceKitInterface
    protected lateinit var targetContext: Context

    /** Each log line of `DatLink` since the start of the test. */
    protected val datLog = CopyOnWriteArrayList<String>()

    protected val glance: GlanceApp get() = targetContext.applicationContext as GlanceApp

    protected val glasses: MockGlasses get() = checkNotNull(glance.mockGlasses.glasses) { "No mock glasses are paired." }

    @Before
    open fun setUp() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        targetContext = instrumentation.targetContext
        requireSilentPhone(targetContext)

        mockDeviceKit = MockDeviceKit.getInstance(targetContext)
        onMain {
            glance.datLog = { line -> datLog.add(line) }
            glance.mockGlasses.enable()
            glance.datLink.initialize(bluetoothGranted = false)
        }
        assertTrue("MockDeviceKit is not enabled.", mockDeviceKit.isEnabled)
    }

    @After
    open fun tearDown() {
        onMain { glance.datLink.stopSession() }
        waitUntil("the DAT session stops", STOP_MS) {
            glance.datLink.snapshot.value.session.let { it == DatSession.NONE || it == DatSession.STOPPED }
        }
        onMain {
            glance.mockGlasses.disable()
            glance.datLink.initialize(bluetoothGranted = false)
            glance.datLog = {}
        }
    }

    /** Pairs Ray-Ban Meta glasses that are on, open, and on the face, and waits until the app sees them. */
    protected fun pairGlasses() {
        assertTrue("The pairing failed.", onMain { glance.mockGlasses.pair() })
        waitUntil("the app sees connected glasses", LINK_MS, { glance.datLink.snapshot.value.toString() }) {
            val snapshot = glance.datLink.snapshot.value
            snapshot.registration == DatRegistration.REGISTERED && snapshot.device?.link == DatLinkState.CONNECTED
        }
    }

    protected fun setCameraFeed(assetName: String) {
        val uri = assetUri(assetName)
        onMain { glasses.services.camera.setCameraFeed(uri) }
    }

    /** Plays head movements one time. */
    protected fun playMotion(build: GyroScript.() -> GyroScript) {
        val samples = GyroScript(headConfig()).build().samples().map(::motionSample)
        onMain { glasses.services.motion.setMotionFeed(samples, false) }
    }

    /** The script starts with a rest, so the detector starts from rest. */
    protected fun playNod() = playMotion { rest(REST_MS).pitch(NOD_RAD, STROKE_MS).pitch(-NOD_RAD, STROKE_MS).rest(REST_MS) }

    protected fun motionSample(sample: GyroSample): MotionSample = MotionSample(sample.tNs, null, Vector3(sample.x, sample.y, sample.z), null, null, MotionSource.GLASSES)

    protected fun headConfig(): HeadGestureConfig = HeadGestureConfig.of(Sensitivity.NORMAL, ProbeDecisions.PITCH_AXIS, ProbeDecisions.PITCH_DOWN_SIGN, ProbeDecisions.YAW_AXIS)

    protected fun <R> onMain(block: () -> R): R = onMainSync(block)

    protected companion object {
        const val LINK_MS = 10_000L
        const val STOP_MS = 10_000L
        const val REST_MS = 600
        const val STROKE_MS = 250

        /** 15 degrees, the nod of the probe button `Mock: nod`. */
        const val NOD_RAD = 0.26
    }
}
