package com.metaglance.android.mock

import android.content.Context
import android.net.Uri
import com.meta.wearable.dat.core.types.Permission
import com.meta.wearable.dat.core.types.PermissionStatus
import com.meta.wearable.dat.mockdevice.MockDeviceKit
import com.meta.wearable.dat.mockdevice.api.GlassesModel
import com.meta.wearable.dat.mockdevice.api.MockDeviceKitConfig
import com.meta.wearable.dat.mockdevice.api.MockGlasses
import com.meta.wearable.dat.mockdevice.api.camera.CameraFacing
import com.meta.wearable.dat.motion.types.MotionSample
import com.meta.wearable.dat.motion.types.MotionSource
import com.meta.wearable.dat.motion.types.Vector3
import com.metaglance.core.gesture.GyroSample

/** The mock glasses of MockDeviceKit. The app holds one instance, and it holds one pair of mock glasses at most. */
class MockGlassesController(context: Context) {
    private val kit by lazy { MockDeviceKit.getInstance(context.applicationContext) }

    val enabled: Boolean get() = kit.isEnabled

    var glasses: MockGlasses? = null
        private set

    /**
     * Also initializes the SDK. Call `DatLink.initialize` after it. A kit that is enabled starts again, so that
     * `registered` takes effect, and its mock glasses are gone then.
     */
    fun enable(registered: Boolean = true) {
        if (kit.isEnabled) disable()
        kit.enable(MockDeviceKitConfig(initiallyRegistered = registered, initialPermissionsGranted = true))
    }

    fun disable() {
        kit.disable()
        glasses = null
    }

    /** Pairs Ray-Ban Meta glasses that are on, open, and on the face. Returns false if the pairing fails. */
    fun pair(): Boolean {
        if (glasses != null) return true
        val paired = kit.pairGlasses(GlassesModel.RAYBAN_META).getOrNull() ?: return false
        paired.powerOn()
        paired.unfold()
        paired.don()
        glasses = paired
        return true
    }

    /** The caller gets `android.permission.CAMERA` first. Without it, the mock stream does not start. */
    fun usePhoneCamera() {
        glasses?.services?.camera?.setCameraFeed(CameraFacing.BACK)
    }

    /** Sets the camera permission of the SDK, and the answer to the next request for it. */
    fun setCameraPermission(granted: Boolean) {
        val status = if (granted) PermissionStatus.Granted else PermissionStatus.Denied
        kit.permissions.set(Permission.CAMERA, status)
        kit.permissions.setRequestResult(Permission.CAMERA, status)
    }

    /** Sets only the answer to the next request for the camera permission. */
    fun setCameraRequestResult(granted: Boolean) {
        kit.permissions.setRequestResult(Permission.CAMERA, if (granted) PermissionStatus.Granted else PermissionStatus.Denied)
    }

    fun setNextRegistration(works: Boolean) = kit.simulateRegistrationOutcome(works)

    /** Plays head movements one time. Returns false with no mock glasses. */
    fun replayMotion(samples: List<GyroSample>): Boolean {
        val motion = glasses?.services?.motion ?: return false
        motion.setMotionFeed(samples.map { MotionSample(it.tNs, null, Vector3(it.x, it.y, it.z), null, null, MotionSource.GLASSES) }, false)
        return true
    }

    /** Plays a motion file in the CSV format of MockDeviceKit. `file` is a file address. */
    fun replayMotionFile(file: Uri): Boolean {
        val motion = glasses?.services?.motion ?: return false
        motion.setMotionFeed(file)
        return true
    }

    /** Sends a final transcript, as if the shopper said `text`. */
    fun say(text: String): Boolean {
        val speech = glasses?.services?.speech ?: return false
        speech.simulateTranscription(text, true, SPOKEN_CONFIDENCE)
        return true
    }

    private companion object {
        const val SPOKEN_CONFIDENCE = 0.9f
    }
}
