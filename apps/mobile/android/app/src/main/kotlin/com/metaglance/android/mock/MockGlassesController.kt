package com.metaglance.android.mock

import android.content.Context
import com.meta.wearable.dat.mockdevice.MockDeviceKit
import com.meta.wearable.dat.mockdevice.api.GlassesModel
import com.meta.wearable.dat.mockdevice.api.MockDeviceKitConfig
import com.meta.wearable.dat.mockdevice.api.MockGlasses
import com.meta.wearable.dat.mockdevice.api.camera.CameraFacing

/** The mock glasses of MockDeviceKit. The app holds one instance, and it holds one pair of mock glasses at most. */
class MockGlassesController(context: Context) {
    private val kit by lazy { MockDeviceKit.getInstance(context.applicationContext) }

    val enabled: Boolean get() = kit.isEnabled

    var glasses: MockGlasses? = null
        private set

    /** Also initializes the SDK. Call `DatLink.initialize` after it. */
    fun enable(registered: Boolean = true) {
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
}
