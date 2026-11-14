package com.metaglance.android.dat

import android.app.Activity
import android.app.Application
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.os.SystemClock
import androidx.exifinterface.media.ExifInterface
import com.meta.wearable.dat.camera.Camera
import com.meta.wearable.dat.camera.addCamera
import com.meta.wearable.dat.camera.types.PhotoData
import com.meta.wearable.dat.camera.types.StreamConfiguration
import com.meta.wearable.dat.camera.types.StreamState
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
import com.meta.wearable.dat.inputs.Inputs
import com.meta.wearable.dat.inputs.addInputs
import com.meta.wearable.dat.inputs.removeInputs
import com.meta.wearable.dat.inputs.types.InputEvent
import com.meta.wearable.dat.inputs.types.InputSource
import com.meta.wearable.dat.inputs.types.InputsConfiguration
import com.meta.wearable.dat.inputs.types.InputsState
import com.meta.wearable.dat.mockdevice.MockDeviceKit
import com.meta.wearable.dat.motion.Motion
import com.meta.wearable.dat.motion.addMotion
import com.meta.wearable.dat.motion.types.MotionConfiguration
import com.meta.wearable.dat.motion.types.MotionSample
import com.meta.wearable.dat.motion.types.MotionSamplingRate
import com.meta.wearable.dat.motion.types.MotionState
import com.meta.wearable.dat.speech.Speech
import com.meta.wearable.dat.speech.addSpeech
import com.meta.wearable.dat.speech.types.SpeechState
import com.meta.wearable.dat.speech.types.TranscriptionResult
import com.metaglance.core.gesture.GyroSample
import com.metaglance.core.gesture.MotionRow
import com.metaglance.core.image.I420
import com.metaglance.core.image.RawFrame
import com.metaglance.core.input.TouchEvent
import com.metaglance.core.input.Transcript
import com.metaglance.core.state.DatDevice
import com.metaglance.core.state.DatFault
import com.metaglance.core.state.DatLinkState
import com.metaglance.core.state.DatPermission
import com.metaglance.core.state.DatRegistration
import com.metaglance.core.state.DatSession
import com.metaglance.core.state.DatSnapshot
import com.metaglance.core.state.DatStream
import com.metaglance.core.state.Revival
import java.io.ByteArrayInputStream
import java.nio.ByteBuffer
import java.util.Locale
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
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
import kotlinx.coroutines.withContext

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

    private val _gyro = MutableSharedFlow<GyroSample>(extraBufferCapacity = MOTION_BUFFER, onBufferOverflow = BufferOverflow.DROP_OLDEST)

    /** The motion samples that carry a gyroscope reading, in rad/s. */
    val gyro: SharedFlow<GyroSample> = _gyro.asSharedFlow()

    private val _motionRows = MutableSharedFlow<MotionRow>(extraBufferCapacity = MOTION_BUFFER, onBufferOverflow = BufferOverflow.DROP_OLDEST)

    /** Each motion sample, for a recorder. A missing reading is 0. A missing orientation is 1, 0, 0, 0. */
    val motionRows: SharedFlow<MotionRow> = _motionRows.asSharedFlow()

    private val _touches = MutableSharedFlow<TouchEvent>(extraBufferCapacity = EVENT_BUFFER, onBufferOverflow = BufferOverflow.DROP_OLDEST)
    val touches: SharedFlow<TouchEvent> = _touches.asSharedFlow()

    private val _transcripts = MutableSharedFlow<Transcript>(extraBufferCapacity = EVENT_BUFFER, onBufferOverflow = BufferOverflow.DROP_OLDEST)
    val transcripts: SharedFlow<Transcript> = _transcripts.asSharedFlow()

    /** The number of motion samples since Motion was attached to the current session. */
    var motionSampleCount: Long = 0
        private set

    private var initialized = false
    private var appFlows: Job? = null
    private var deviceId: DeviceIdentifier? = null
    private var current: SessionRun? = null

    /** Selects the device again from the metadata of the SDK. `watchDevices` sets it. */
    private var selectDevice: () -> Unit = {}

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

    /** Adds Motion at 30 Hz to the session and starts it. The session must be `STARTED`. */
    fun attachMotion() {
        current?.attachMotion() ?: log("motion: no session")
    }

    /** Adds Inputs to the session. Inputs starts by itself. The session must be `STARTED`. */
    fun attachInputs(sources: Set<InputSource>) {
        current?.attachInputs(sources) ?: log("inputs: no session")
    }

    /** Adds Speech to the session and starts it. It does nothing without the microphone permission of the SDK. */
    fun attachSpeech() {
        current?.attachSpeech() ?: log("speech: no session")
    }

    /**
     * Takes a still photo while the stream runs. Returns null on a failure, and `faults` gets the error.
     * The BirdSpotter sample of Meta starts Motion, Inputs, and Speech again after a still.
     */
    suspend fun captureStill(): Bitmap? {
        val stream = current?.camera?.stream
        if (stream == null) {
            log("still: no stream")
            return null
        }
        val startMs = SystemClock.elapsedRealtime()
        val result = stream.capturePhoto()
        val photo = result.getOrNull()
        if (photo == null) {
            result.onFailure { error, _ -> fault(DatFault.Area.CAPTURE, error) }
            return null
        }
        val bitmap = when (photo) {
            is PhotoData.Bitmap -> photo.bitmap
            is PhotoData.HEIC -> withContext(Dispatchers.Default) { decodeHeic(photo.data) }
        }
        val variant = if (photo is PhotoData.Bitmap) "Bitmap" else "HEIC"
        if (bitmap == null) {
            log("still: the $variant data does not decode")
            return null
        }
        log("still ${bitmap.width}x${bitmap.height} $variant ${SystemClock.elapsedRealtime() - startMs} ms")
        return bitmap
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

    /**
     * Runs a call that adds a capability to a session. The SDK returns its errors as a `DatResult`, but with
     * DAT 1.0.1 `addInputs` threw an IllegalStateException ("Could not get shared DWA channel") for a session that
     * mock glasses had just ended with a fold. The app must not stop for that. Returns null after such a failure.
     */
    private inline fun <T> sdkCall(what: String, call: () -> T): T? = try {
        call()
    } catch (e: IllegalStateException) {
        log("$what failed: ${e.message}")
        null
    }

    private fun requireInitialized(action: String): Boolean {
        if (!initialized) log("$action: dat is not initialized")
        return initialized
    }

    // MockDeviceKit swaps the registration and device layers of the SDK, so each initialize call collects again.
    private fun collectAppFlows() {
        appFlows?.cancel()
        selectDevice = {}
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
        selectDevice = ::select
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

    private fun MotionSample.toRow(): MotionRow {
        val a = accelerometer
        val g = gyroscope
        val m = magnetometer
        val o = orientation
        return MotionRow(
            timestampNs,
            a?.x ?: 0f, a?.y ?: 0f, a?.z ?: 0f,
            g?.x ?: 0f, g?.y ?: 0f, g?.z ?: 0f,
            m?.x ?: 0f, m?.y ?: 0f, m?.z ?: 0f,
            o?.w ?: 1f, o?.x ?: 0f, o?.y ?: 0f, o?.z ?: 0f
        )
    }

    private fun decodeHeic(data: ByteBuffer): Bitmap? {
        val bytes = ByteArray(data.remaining())
        data.duplicate().get(bytes)
        val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: return null
        val orientation = ExifInterface(ByteArrayInputStream(bytes))
            .getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
        val degrees = when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> 90f
            ExifInterface.ORIENTATION_ROTATE_180 -> 180f
            ExifInterface.ORIENTATION_ROTATE_270 -> 270f
            else -> return bitmap
        }
        val matrix = Matrix().apply { postRotate(degrees) }
        return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
    }

    /**
     * One DAT session with its camera and its capabilities. The SDK cannot start a stopped session again, so each
     * start makes a new run.
     */
    private inner class SessionRun(
        val session: DeviceSession,
        val withCamera: Boolean,
        val autoAttach: Boolean
    ) {
        private val job = SupervisorJob(scope.coroutineContext.job)
        private val runScope = CoroutineScope(scope.coroutineContext + job)

        var camera: Camera? = null
            private set
        private var cameraScope: CoroutineScope? = null
        private var cameraRequested = false

        /** When the app asked for the camera, and when its stream first reached STREAMING. */
        private var cameraAtMs: Long? = null
        private var streamingAtMs: Long? = null
        private var autoAttached = false

        private var motion: Motion? = null
        private val motionRevival = Revival()

        private var inputs: Inputs? = null
        private var inputsScope: CoroutineScope? = null
        private var inputSources: Set<InputSource> = emptySet()
        private val inputsRevival = Revival()

        private var speech: Speech? = null
        private val speechRevival = Revival()

        var stopRequested = false
            private set

        private val isCurrent: Boolean get() = current === this

        private val canRevive: Boolean
            get() = !stopRequested && session.state.value == DeviceSessionState.STARTED

        // A collector that starts with UNDISPATCHED is subscribed when launch returns. So a call to start() of the
        // SDK that follows it loses no state, no error, and no sample.
        private fun CoroutineScope.subscribe(block: suspend CoroutineScope.() -> Unit): Job = launch(start = CoroutineStart.UNDISPATCHED, block = block)

        private fun childScope(): CoroutineScope = CoroutineScope(runScope.coroutineContext + SupervisorJob(job))

        fun start() {
            runScope.subscribe { session.state.collect { onState(it) } }
            runScope.subscribe {
                session.errors.collect { error ->
                    if (error == DeviceSessionError.DAT_APP_ON_THE_GLASSES_UPDATE_REQUIRED) {
                        _snapshot.update { it.copy(glassesAppUpdateRequired = true) }
                    }
                    fault(DatFault.Area.SESSION, error)
                }
            }
            runScope.subscribe { session.deviceInfo.collect { if (isCurrent) setDevice(it) } }
            session.start()
        }

        fun stop() {
            if (stopRequested) return
            stopRequested = true
            if (stopWaitMs() <= 0) {
                stopNow()
                return
            }
            log("session: the stream just started, so the stop waits")
            runScope.launch {
                // The stream can reach STREAMING during the wait, and then the wait starts again from that time.
                val giveUpAtMs = SystemClock.elapsedRealtime() + MAX_STOP_WAIT_MS
                while (true) {
                    val waitMs = minOf(stopWaitMs(), giveUpAtMs - SystemClock.elapsedRealtime())
                    if (waitMs <= 0) break
                    delay(waitMs)
                }
                stopNow()
            }
        }

        /** The time that a stop must still wait, so that it does not meet the start of the video decoder. */
        private fun stopWaitMs(): Long {
            val startedAtMs = streamingAtMs ?: cameraAtMs ?: return 0
            return startedAtMs + STOP_AFTER_STREAM_START_MS - SystemClock.elapsedRealtime()
        }

        private fun stopNow() {
            camera?.stop()
            session.stop()
            // The stream collectors end here, so no later stream state arrives. The snapshot gets the end states
            // from this function and from release.
            cameraScope?.cancel()
            camera = null
            if (isCurrent) {
                _snapshot.update { it.copy(session = session.state.value.toCore(), stream = endStream(DatStream.STOPPING)) }
            }
            // The state collector stays until STOPPED arrives. Then onState releases this run.
        }

        fun release() {
            job.cancel()
            if (isCurrent) {
                current = null
                _snapshot.update {
                    it.copy(stream = endStream(DatStream.STOPPED), motionStarted = false, inputsActive = false, speechStarted = false)
                }
                // During the run, the snapshot followed deviceInfo of the session, and that flow is closed now.
                // The metadata of the SDK can hold a newer state, for example a lost link.
                selectDevice()
            }
        }

        // A run with no camera has no stream.
        private fun endStream(state: DatStream): DatStream = if (cameraRequested) state else DatStream.NONE

        private fun onState(state: DeviceSessionState) {
            log("session $state")
            if (isCurrent) _snapshot.update { it.copy(session = state.toCore()) }
            when (state) {
                DeviceSessionState.STARTED -> if (withCamera && !cameraRequested && !stopRequested) attachCamera()
                DeviceSessionState.STOPPED -> release()
                else -> Unit
            }
        }

        private fun attachCamera() {
            cameraRequested = true
            cameraAtMs = SystemClock.elapsedRealtime()
            session.addCamera(StreamConfiguration(videoQuality = VideoQuality.HIGH, frameRate = STREAM_FPS)).fold(
                onSuccess = { added ->
                    camera = added
                    val stream = added.stream
                    val collectors = childScope().also { cameraScope = it }
                    collectors.subscribe { stream.state.collect { onStreamState(it) } }
                    collectors.subscribe { stream.errorStream.collect { fault(DatFault.Area.STREAM, it) } }
                    collectors.launch(Dispatchers.Default) {
                        val meter = FrameMeter()
                        stream.videoStream.collect { frame -> onFrame(frame, meter) }
                    }
                    stream.start().onFailure { error, _ -> fault(DatFault.Area.STREAM, error) }
                },
                onFailure = { error, _ -> fault(DatFault.Area.SESSION, error) }
            )
        }

        private fun onStreamState(state: StreamState) {
            log("stream $state")
            if (state == StreamState.STREAMING && streamingAtMs == null) streamingAtMs = SystemClock.elapsedRealtime()
            if (isCurrent) _snapshot.update { it.copy(stream = state.toCore()) }
            // The BirdSpotter sample of Meta attaches its sensors at the same point.
            if (state == StreamState.STREAMING && autoAttach && !autoAttached && !stopRequested) {
                autoAttached = true
                if (ProbeDecisions.MOTION) attachMotion()
                if (ProbeDecisions.INPUTS) attachInputs(ProbeDecisions.INPUT_SOURCES)
                if (ProbeDecisions.SPEECH) attachSpeech()
            }
        }

        fun attachMotion() {
            if (motion != null) {
                log("motion: it is attached")
                return
            }
            sdkCall("add motion") { session.addMotion(MotionConfiguration(samplingRate = MotionSamplingRate.HZ_30)) }?.fold(
                onSuccess = { added ->
                    motion = added
                    motionSampleCount = 0
                    // The samples flow has no replay, so its collector comes first.
                    runScope.subscribe { added.samples.collect { onMotionSample(it) } }
                    runScope.subscribe { added.state.collect { onMotionState(added, it) } }
                    runScope.subscribe { added.errors.collect { error -> error?.let { fault(DatFault.Area.MOTION, it) } } }
                    runScope.launch {
                        while (true) {
                            delay(MOTION_COUNT_LOG_MS)
                            if (_snapshot.value.motionStarted) log("motion samples=$motionSampleCount")
                        }
                    }
                    added.start()
                },
                onFailure = { error, _ -> fault(DatFault.Area.MOTION, error) }
            )
        }

        private fun onMotionSample(sample: MotionSample) {
            motionSampleCount += 1
            _motionRows.tryEmit(sample.toRow())
            val g = sample.gyroscope ?: return
            _gyro.tryEmit(GyroSample(sample.timestampNs, g.x, g.y, g.z))
        }

        private fun onMotionState(motion: Motion, state: MotionState) {
            log("motion $state")
            if (isCurrent) _snapshot.update { it.copy(motionStarted = state == MotionState.STARTED) }
            when (state) {
                MotionState.STARTED -> motionRevival.onStarted()
                MotionState.STOPPED -> if (motionRevival.onStopped(byApp = !canRevive)) {
                    val attempt = motionRevival.attempts
                    runScope.launch {
                        delay(REVIVE_DELAY_MS)
                        if (!canRevive) return@launch
                        log("revive motion $attempt")
                        motion.start()
                    }
                }
                else -> Unit
            }
        }

        fun attachInputs(sources: Set<InputSource>) {
            if (inputs != null) {
                log("inputs: it is attached")
                return
            }
            inputSources = sources
            sdkCall("add inputs") { session.addInputs(InputsConfiguration(sources = sources, consumeBack = true)) }?.fold(
                onSuccess = { added ->
                    inputs = added
                    val collectors = childScope().also { inputsScope = it }
                    collectors.subscribe { added.events.collect { onInputEvent(it) } }
                    collectors.subscribe { added.errors.collect { error -> error?.let { fault(DatFault.Area.INPUTS, it) } } }
                    // Inputs starts by itself. A new instance reports INACTIVE first, and that is not a stop.
                    var leftInactive = false
                    collectors.subscribe {
                        added.state.collect { state ->
                            val stopped = state == InputsState.INACTIVE && leftInactive
                            if (state != InputsState.INACTIVE) leftInactive = true
                            onInputsState(state, stopped)
                        }
                    }
                },
                onFailure = { error, _ -> fault(DatFault.Area.INPUTS, error) }
            )
        }

        private fun onInputEvent(event: InputEvent) {
            val touch = when (event) {
                is InputEvent.Select -> TouchEvent.DOUBLE_TAP
                is InputEvent.Nav -> TouchEvent.SWIPE
                is InputEvent.Back, is InputEvent.Button, is InputEvent.Capture, is InputEvent.Drag -> return
            }
            log("touch $touch")
            _touches.tryEmit(touch)
        }

        private fun onInputsState(state: InputsState, stopped: Boolean) {
            log("inputs $state")
            if (isCurrent) _snapshot.update { it.copy(inputsActive = state == InputsState.ACTIVE) }
            if (state == InputsState.ACTIVE) inputsRevival.onStarted()
            if (stopped && inputsRevival.onStopped(byApp = !canRevive)) {
                val attempt = inputsRevival.attempts
                val stoppedInputs = inputs
                // Inputs also stops when the glasses end the session, a moment before the session reports it.
                // So the revival waits, as for Motion and Speech, and then reads the session state again.
                runScope.launch {
                    delay(REVIVE_DELAY_MS)
                    if (!canRevive || inputs !== stoppedInputs) return@launch
                    log("revive inputs $attempt")
                    val old = inputsScope
                    inputs = null
                    session.removeInputs().onFailure { error, _ -> fault(DatFault.Area.INPUTS, error) }
                    attachInputs(inputSources)
                    old?.cancel()
                }
            }
        }

        fun attachSpeech() {
            if (speech != null) {
                log("speech: it is attached")
                return
            }
            if (_snapshot.value.microphonePermission != DatPermission.GRANTED) {
                log("speech: the microphone permission is not granted")
                return
            }
            sdkCall("add speech") { session.addSpeech() }?.fold(
                onSuccess = { added ->
                    speech = added
                    runScope.subscribe { added.transcriptions.collect { result -> result?.let { onTranscription(added, it) } } }
                    runScope.subscribe { added.state.collect { onSpeechState(added, it) } }
                    runScope.subscribe { added.locale.collect { locale -> locale?.let { log("speech locale=$it") } } }
                    runScope.subscribe { added.errors.collect { error -> error?.let { fault(DatFault.Area.SPEECH, it) } } }
                    added.start().onFailure { error, _ -> fault(DatFault.Area.SPEECH, error) }
                },
                onFailure = { error, _ -> fault(DatFault.Area.SPEECH, error) }
            )
        }

        private fun onTranscription(speech: Speech, result: TranscriptionResult) {
            val confidence = result.confidence.takeIf { it >= 0f }
            val kind = if (result.isFinal) "final" else "partial"
            log("transcript \"${result.text}\" $kind" + (confidence?.let { " $it" } ?: ""))
            _transcripts.tryEmit(Transcript(result.text, result.isFinal, confidence, speech.locale.value))
        }

        private fun onSpeechState(speech: Speech, state: SpeechState) {
            log("speech $state" + (speech.locale.value?.let { " locale=$it" } ?: ""))
            if (isCurrent) _snapshot.update { it.copy(speechStarted = state == SpeechState.STARTED) }
            when (state) {
                SpeechState.STARTED -> speechRevival.onStarted()
                SpeechState.STOPPED -> if (speechRevival.onStopped(byApp = !canRevive)) {
                    val attempt = speechRevival.attempts
                    runScope.launch {
                        delay(REVIVE_DELAY_MS)
                        if (!canRevive) return@launch
                        log("revive speech $attempt")
                        speech.start().onFailure { error, _ -> fault(DatFault.Area.SPEECH, error) }
                    }
                }
                else -> Unit
            }
        }
    }

    // Runs on a background thread. The SDK can use the buffer again after this call returns, so the copy comes
    // first, before any suspension.
    private fun onFrame(frame: VideoFrame, meter: FrameMeter) {
        if (frame.isCompressed) return
        // I420 has one chroma sample for each 2 x 2 pixels, so a frame with an odd side has no I420 layout.
        if (frame.width % 2 != 0 || frame.height % 2 != 0) {
            meter.logOnce("odd:${frame.width}x${frame.height}", "frame size ${frame.width}x${frame.height} is odd, so the frame is dropped")
            return
        }
        val buffer = frame.buffer
        val position = buffer.position()
        val bytes = ByteArray(buffer.remaining())
        buffer.get(bytes)
        buffer.position(position)

        val expected = I420.frameBytes(frame.width, frame.height)
        if (bytes.size != expected) {
            meter.logOnce(
                "${frame.width}x${frame.height}:${bytes.size}",
                "frame size ${frame.width}x${frame.height} has ${bytes.size} bytes, I420 has $expected"
            )
            if (bytes.size < expected) return
        }
        frameCount += 1
        frameSize = "${frame.width}x${frame.height}"
        _frames.tryEmit(RawFrame(bytes, frame.width, frame.height, frame.presentationTimeUs))
        meter.count(frame.width, frame.height)
    }

    /** Logs the frame rate one time each second, and a frame size that is not in order. */
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

        /** Logs a line about a frame size that is not in order. Frames in a row with the same `key` give one line. */
        fun logOnce(key: String, line: String) {
            if (key == reportedSize) return
            reportedSize = key
            log(line)
        }
    }

    private companion object {
        const val STREAM_FPS = 7
        const val NS_PER_SECOND = 1_000_000_000L
        const val REVIVE_DELAY_MS = 750L

        // Measured with DAT 1.0.1 and mock glasses on a Nothing Phone (1), Android 15: a stop at the moment the
        // stream reaches STREAMING ends the app process. The video decoder of the SDK calls MediaCodec.reset on its
        // own thread while the stop releases the same codec, and the system aborts in the destructor of MediaCodec
        // (MediaCodec.cpp, CHECK_EQ(mState, UNINITIALIZED)). So a stop waits until the stream is this old.
        const val STOP_AFTER_STREAM_START_MS = 1000L
        const val MAX_STOP_WAIT_MS = 3000L
        const val MOTION_COUNT_LOG_MS = 3000L
        const val EVENT_BUFFER = 16
        const val MOTION_BUFFER = 64
    }
}
