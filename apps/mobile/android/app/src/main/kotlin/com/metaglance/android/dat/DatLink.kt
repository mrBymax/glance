package com.metaglance.android.dat

import android.app.Activity
import android.app.Application
import android.content.Intent
import com.meta.wearable.dat.camera.Camera
import com.meta.wearable.dat.camera.addCamera
import com.meta.wearable.dat.camera.types.StreamConfiguration
import com.meta.wearable.dat.camera.types.VideoFrame
import com.meta.wearable.dat.camera.types.VideoQuality
import com.meta.wearable.dat.core.Wearables
import com.meta.wearable.dat.core.selectors.SpecificDeviceSelector
import com.meta.wearable.dat.core.session.DeviceSession
import com.meta.wearable.dat.core.session.DeviceSessionState
import com.meta.wearable.dat.core.types.DatError
import com.meta.wearable.dat.core.types.DatResult
import com.meta.wearable.dat.core.types.Device
import com.meta.wearable.dat.core.types.DeviceIdentifier
import com.meta.wearable.dat.core.types.DeviceSessionError
import com.meta.wearable.dat.core.types.LinkState
import com.meta.wearable.dat.core.types.NavigationError
import com.meta.wearable.dat.core.types.Permission
import com.meta.wearable.dat.core.types.PermissionError
import com.meta.wearable.dat.core.types.PermissionStatus
import com.meta.wearable.dat.core.types.RegistrationError
import com.meta.wearable.dat.core.types.RegistrationState
import com.meta.wearable.dat.core.types.WearablesError
import com.meta.wearable.dat.mockdevice.MockDeviceKit
import com.metaglance.core.image.I420
import com.metaglance.core.image.RawFrame
import com.metaglance.core.state.DatDevice
import com.metaglance.core.state.DatFault
import com.metaglance.core.state.DatLinkState
import com.metaglance.core.state.DatPermission
import com.metaglance.core.state.DatRegistration
import com.metaglance.core.state.DatSession
import com.metaglance.core.state.DatSnapshot
import com.metaglance.core.state.DatStream
import java.util.Locale
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.job
import kotlinx.coroutines.launch

/**
 * The one connection of the app to the DAT SDK: registration, permissions, the device, the session, and the stream.
 *
 * Call each function on the main thread. `scope` must use the main dispatcher. The frame collector is the one part
 * that runs on another thread.
 */
class DatLink(
    private val app: Application,
    private val scope: CoroutineScope,
    private val log: (String) -> Unit
) {
    private val _snapshot = MutableStateFlow(
        DatSnapshot(
            bluetoothGranted = false,
            metaAiInstalled = true,
            registration = DatRegistration.UNAVAILABLE,
            cameraPermission = DatPermission.UNKNOWN,
            microphonePermission = DatPermission.UNKNOWN,
            device = null,
            session = DatSession.NONE,
            stream = DatStream.NONE,
            motionStarted = false,
            inputsActive = false,
            speechStarted = false,
            glassesAppUpdateRequired = false,
            mock = false
        )
    )
    val snapshot: StateFlow<DatSnapshot> = _snapshot.asStateFlow()

    private val _faults = MutableSharedFlow<DatFault>(extraBufferCapacity = 16, onBufferOverflow = BufferOverflow.DROP_OLDEST)
    val faults: SharedFlow<DatFault> = _faults.asSharedFlow()

    private val _frames = MutableSharedFlow<RawFrame>(replay = 0, extraBufferCapacity = 1, onBufferOverflow = BufferOverflow.DROP_OLDEST)

    /** The newest frame only. A slow collector misses frames. */
    val frames: SharedFlow<RawFrame> = _frames.asSharedFlow()

    /** The number of frames of the current session, or of the last one. */
    @Volatile
    var frameCount: Long = 0
        private set

    /** Width and height of the newest frame, for example `720x1280`. Empty before the first frame. */
    @Volatile
    var frameSize: String = ""
        private set

    private var initialized = false
    private var appFlows: Job? = null
    private var deviceId: DeviceIdentifier? = null
    private var current: SessionRun? = null

    /**
     * Safe to call again. With `bluetoothGranted = false` it only records the fact, because the SDK needs Bluetooth.
     * With MockDeviceKit enabled it does not call the SDK: `MockDeviceKit.enable` initializes it.
     */
    fun initialize(bluetoothGranted: Boolean) {
        val mock = MockDeviceKit.getInstance(app).isEnabled
        _snapshot.update { it.copy(bluetoothGranted = bluetoothGranted, mock = mock) }
        if (!mock) {
            if (!bluetoothGranted) return
            var failure: WearablesError? = null
            Wearables.initialize(app).onFailure { error, _ ->
                if (error != WearablesError.ALREADY_INITIALIZED) failure = error
            }
            failure?.let {
                log("dat initialize error ${it.name}")
                return
            }
        }
        initialized = true
        log(if (mock) "dat initialized mock" else "dat initialized")
        collectAppFlows()
    }

    fun register(activity: Activity) {
        if (!requireInitialized("register")) return
        Wearables.startRegistration(activity)
    }

    /**
     * Gives an intent of the activity to the SDK. Meta AI can start a registration with such an intent.
     * Call it from `onCreate` and from `onNewIntent`. The SDK ignores each other intent.
     */
    fun handleIntent(activity: Activity, intent: Intent?) {
        if (intent == null || !initialized) return
        Wearables.handleIntent(intent) { request ->
            log("registration request from Meta AI")
            request.continueRegistration(activity).onFailure { error, _ ->
                log("registration request error ${error.constantName()}")
            }
        }.onFailure { error, _ -> log("intent error ${error.constantName()}") }
    }

    /** Reads the camera permission and the microphone permission from the SDK. */
    suspend fun refreshPermissions() {
        if (!requireInitialized("permissions")) return
        for (permission in Permission.entries) {
            onPermissionResult(permission, Wearables.checkPermissionStatus(permission))
        }
    }

    fun onPermissionResult(permission: Permission, result: DatResult<PermissionStatus, PermissionError>) {
        result.fold(
            onSuccess = { status -> onPermissionResult(permission, status) },
            onFailure = { error, _ ->
                if (error == PermissionError.META_AI_NOT_INSTALLED) setMetaAiInstalled(false)
                fault(DatFault.Area.PERMISSION, error)
                onPermissionResult(permission, null)
            }
        )
    }

    /** `status = null` means that the request failed. The stored status does not change then. */
    fun onPermissionResult(permission: Permission, status: PermissionStatus?) {
        val label = permission.name.lowercase(Locale.US)
        if (status == null) {
            log("$label permission request failed")
            return
        }
        val value = status.toCore()
        _snapshot.update {
            when (permission) {
                Permission.CAMERA -> it.copy(cameraPermission = value)
                Permission.MICROPHONE -> it.copy(microphonePermission = value)
            }
        }
        log("$label permission $value")
    }

    /**
     * Creates a session on the connected glasses and starts it. Returns false if there is no connected device, or
     * if the SDK does not create the session. In the second case, `faults` gets the error.
     */
    fun startSession(withCamera: Boolean = true, autoAttach: Boolean = false): Boolean {
        if (!requireInitialized("session")) return false
        current?.let { old ->
            if (!old.stopRequested) {
                log("session: a session exists")
                return true
            }
            old.release()
        }
        // An AutoDeviceSelector that is built here is still empty, and the session fails with NO_ELIGIBLE_DEVICE.
        // The BirdSpotter sample of Meta reports that. So the session names the device.
        val id = deviceId.takeIf { _snapshot.value.device?.link == DatLinkState.CONNECTED }
        if (id == null) {
            log("session: no connected device")
            return false
        }
        return Wearables.createSession(SpecificDeviceSelector(id)).fold(
            onSuccess = { session ->
                frameCount = 0
                val run = SessionRun(session, withCamera, autoAttach)
                current = run
                run.start()
                true
            },
            onFailure = { error, _ ->
                fault(DatFault.Area.SESSION, error)
                false
            }
        )
    }

    /** Stops the camera, then the session. A stopped session is final: the next start creates a new one. */
    fun stopSession() {
        current?.stop()
    }

    /** Opens the update screen of Meta AI: for the app on the glasses if the session asked for it, else for the firmware. */
    fun openUpdate(activity: Activity) {
        if (!requireInitialized("update")) return
        val result = if (_snapshot.value.glassesAppUpdateRequired) {
            Wearables.openDATGlassesAppUpdate(activity)
        } else {
            Wearables.openFirmwareUpdate(activity)
        }
        result.onFailure { error, _ ->
            if (error == NavigationError.META_AI_NOT_INSTALLED) setMetaAiInstalled(false)
            log("update error ${error.name}")
        }
    }

    private fun requireInitialized(action: String): Boolean {
        if (!initialized) log("$action: dat is not initialized")
        return initialized
    }

    // MockDeviceKit swaps the registration and device layers of the SDK, so each initialize call collects again.
    private fun collectAppFlows() {
        appFlows?.cancel()
        appFlows = scope.launch {
            launch {
                Wearables.registrationState.collect { state ->
                    _snapshot.update { it.copy(registration = state.toCore()) }
                    if (state == RegistrationState.REGISTERING || state == RegistrationState.REGISTERED) {
                        setMetaAiInstalled(true)
                    }
                    log("registration $state")
                }
            }
            launch {
                Wearables.registrationErrorStream.collect { error ->
                    if (error == RegistrationError.META_AI_NOT_INSTALLED) setMetaAiInstalled(false)
                    fault(DatFault.Area.REGISTRATION, error)
                }
            }
            launch { Wearables.devices.collectLatest { ids -> watchDevices(ids) } }
        }
    }

    // Selects the first connected device, or the first device when none is connected. The link state of a device
    // changes while the set of devices stays the same, so each metadata change selects again.
    private suspend fun watchDevices(ids: Set<DeviceIdentifier>) = coroutineScope {
        val known = HashMap<String, Device>()
        fun select() {
            val id = ids.firstOrNull { known[it.identifier]?.linkState == LinkState.CONNECTED } ?: ids.firstOrNull()
            deviceId = id
            // A running session reports its own device through deviceInfo.
            if (current == null) setDevice(id?.let { known[it.identifier] })
        }
        select()
        for (id in ids) {
            val metadata = Wearables.devicesMetadata[id] ?: continue
            launch {
                metadata.collect { device ->
                    known[id.identifier] = device
                    select()
                }
            }
        }
    }

    private fun setDevice(device: Device?) {
        val value = device?.toCore()
        val before = _snapshot.value.device
        if (value == before) return
        _snapshot.update { it.copy(device = value) }
        log(if (value == null) "device none" else deviceLine(value))
    }

    private fun deviceLine(d: DatDevice): String = "device ${d.name} link=${d.link} battery=${d.battery} don=${d.don} hinge=${d.hinge} thermal=${d.thermal}"

    private fun setMetaAiInstalled(installed: Boolean) {
        _snapshot.update { it.copy(metaAiInstalled = installed) }
    }

    private fun fault(area: DatFault.Area, error: DatError) {
        val name = error.constantName()
        log("${area.name.lowercase(Locale.US)} error $name")
        _faults.tryEmit(DatFault(area, name))
    }

    /** One DAT session with its camera. The SDK cannot start a stopped session again, so each start makes a new run. */
    private inner class SessionRun(
        val session: DeviceSession,
        val withCamera: Boolean,
        val autoAttach: Boolean
    ) {
        private val job = SupervisorJob(scope.coroutineContext.job)
        private val runScope = CoroutineScope(scope.coroutineContext + job)
        private var camera: Camera? = null
        private var cameraJob: Job? = null
        private var cameraRequested = false
        var stopRequested = false
            private set

        fun start() {
            // The collectors start before session.start(), so that no state and no error is lost.
            runScope.launch(start = CoroutineStart.UNDISPATCHED) { session.state.collect { onState(it) } }
            runScope.launch(start = CoroutineStart.UNDISPATCHED) {
                session.errors.collect { error ->
                    if (error == DeviceSessionError.DAT_APP_ON_THE_GLASSES_UPDATE_REQUIRED) {
                        _snapshot.update { it.copy(glassesAppUpdateRequired = true) }
                    }
                    fault(DatFault.Area.SESSION, error)
                }
            }
            runScope.launch(start = CoroutineStart.UNDISPATCHED) {
                session.deviceInfo.collect { if (current === this@SessionRun) setDevice(it) }
            }
            session.start()
        }

        fun stop() {
            if (stopRequested) return
            stopRequested = true
            val lastStream = camera?.stream?.state?.value?.toCore() ?: DatStream.NONE
            camera?.stop()
            session.stop()
            cameraJob?.cancel()
            camera = null
            if (current === this) {
                _snapshot.update { it.copy(session = session.state.value.toCore(), stream = lastStream) }
            }
            // The state collector stays until STOPPED arrives, then onState releases this run.
        }

        fun release() {
            job.cancel()
            if (current === this) current = null
        }

        private fun onState(state: DeviceSessionState) {
            log("session $state")
            if (current === this) _snapshot.update { it.copy(session = state.toCore()) }
            when (state) {
                DeviceSessionState.STARTED -> if (withCamera && !cameraRequested && !stopRequested) attachCamera()
                DeviceSessionState.STOPPED -> release()
                else -> Unit
            }
        }

        private fun attachCamera() {
            cameraRequested = true
            session.addCamera(StreamConfiguration(videoQuality = VideoQuality.HIGH, frameRate = STREAM_FPS)).fold(
                onSuccess = { added ->
                    camera = added
                    val stream = added.stream
                    cameraJob = runScope.launch {
                        launch(start = CoroutineStart.UNDISPATCHED) {
                            stream.state.collect { state ->
                                log("stream $state")
                                if (current === this@SessionRun) _snapshot.update { it.copy(stream = state.toCore()) }
                            }
                        }
                        launch(start = CoroutineStart.UNDISPATCHED) {
                            stream.errorStream.collect { fault(DatFault.Area.STREAM, it) }
                        }
                        launch(Dispatchers.Default) {
                            val meter = FrameMeter()
                            stream.videoStream.collect { frame -> onFrame(frame, meter) }
                        }
                    }
                    stream.start().onFailure { error, _ -> fault(DatFault.Area.STREAM, error) }
                },
                onFailure = { error, _ -> fault(DatFault.Area.SESSION, error) }
            )
        }
    }

    // Runs on a background thread. The SDK can use the buffer again after this call returns, so the copy comes
    // first, before any suspension.
    private fun onFrame(frame: VideoFrame, meter: FrameMeter) {
        if (frame.isCompressed) return
        val buffer = frame.buffer
        val position = buffer.position()
        val bytes = ByteArray(buffer.remaining())
        buffer.get(bytes)
        buffer.position(position)

        val expected = I420.frameBytes(frame.width, frame.height)
        if (bytes.size != expected) {
            meter.logSizeOnce(frame.width, frame.height, bytes.size, expected)
            if (bytes.size < expected) return
        }
        frameCount += 1
        frameSize = "${frame.width}x${frame.height}"
        _frames.tryEmit(RawFrame(bytes, frame.width, frame.height, frame.presentationTimeUs))
        meter.count(frame.width, frame.height)
    }

    /** Logs the frame rate one time each second, and a buffer size that is not I420 one time for each size. */
    private inner class FrameMeter {
        private var windowStartNs = System.nanoTime()
        private var windowFrames = 0
        private var total = 0L
        private var reportedSize = ""

        fun count(width: Int, height: Int) {
            total += 1
            windowFrames += 1
            val elapsedNs = System.nanoTime() - windowStartNs
            if (elapsedNs < NS_PER_SECOND) return
            val fps = windowFrames * NS_PER_SECOND.toDouble() / elapsedNs
            log("frame ${width}x$height #$total fps=${String.format(Locale.US, "%.1f", fps)}")
            windowStartNs = System.nanoTime()
            windowFrames = 0
        }

        fun logSizeOnce(width: Int, height: Int, bytes: Int, expected: Int) {
            val key = "${width}x$height:$bytes"
            if (key == reportedSize) return
            reportedSize = key
            log("frame size ${width}x$height has $bytes bytes, I420 has $expected")
        }
    }

    private companion object {
        const val STREAM_FPS = 7
        const val NS_PER_SECOND = 1_000_000_000L
    }
}
