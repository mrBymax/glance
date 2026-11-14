package com.metaglance.android.session

import android.app.Application
import android.graphics.Bitmap
import android.media.AudioManager
import android.net.ConnectivityManager
import android.net.Network
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.view.WindowManager
import com.metaglance.android.MainActivity
import com.metaglance.android.audio.AnswerSound
import com.metaglance.android.audio.ExoLinePlayer
import com.metaglance.android.audio.PhoneVoice
import com.metaglance.android.dat.DatLink
import com.metaglance.android.dat.ProbeDecisions
import com.metaglance.android.pipeline.CodeScanner
import com.metaglance.android.pipeline.DigitReader
import com.metaglance.android.pipeline.FaceFinder
import com.metaglance.android.pipeline.FramePipeline
import com.metaglance.android.pipeline.LabelOutcome
import com.metaglance.android.pipeline.LabelStill
import com.metaglance.android.pipeline.StillPhoto
import com.metaglance.core.audio.AnswerSoundOnce
import com.metaglance.core.audio.SpeechQueue
import com.metaglance.core.barcode.LabelPolicy
import com.metaglance.core.barcode.LabelTiming
import com.metaglance.core.contract.Codec
import com.metaglance.core.contract.DeviceState
import com.metaglance.core.contract.DeviceToServer
import com.metaglance.core.contract.GlanceJson
import com.metaglance.core.contract.IntentKind
import com.metaglance.core.contract.IntentSource
import com.metaglance.core.contract.MainYes
import com.metaglance.core.contract.NativeState
import com.metaglance.core.contract.NativeToPage
import com.metaglance.core.contract.PageToNative
import com.metaglance.core.contract.Profile
import com.metaglance.core.contract.Profiles
import com.metaglance.core.contract.ServerEvent
import com.metaglance.core.contract.ServerToDevice
import com.metaglance.core.contract.SoundName
import com.metaglance.core.contract.StillPurpose
import com.metaglance.core.frame.FrameHeader
import com.metaglance.core.frame.FrameKind
import com.metaglance.core.gesture.GestureReport
import com.metaglance.core.gesture.HeadGestureConfig
import com.metaglance.core.gesture.HeadGestureDetector
import com.metaglance.core.gesture.HeadSample
import com.metaglance.core.image.StillPolicy
import com.metaglance.core.image.StreamSetup
import com.metaglance.core.image.UploadGate
import com.metaglance.core.image.WaitingStill
import com.metaglance.core.image.WaitingStills
import com.metaglance.core.input.HeadInput
import com.metaglance.core.input.HeadWindowListener
import com.metaglance.core.input.KeyInput
import com.metaglance.core.input.MainYesResolver
import com.metaglance.core.input.PaymentConfirm
import com.metaglance.core.input.PromptOutcome
import com.metaglance.core.input.PromptTracker
import com.metaglance.core.input.TouchInput
import com.metaglance.core.input.VoiceInput
import com.metaglance.core.net.DeviceSocket
import com.metaglance.core.net.GlanceApi
import com.metaglance.core.net.Scheduler
import com.metaglance.core.state.ConnectionAnnouncer
import com.metaglance.core.state.DatDon
import com.metaglance.core.state.DatFault
import com.metaglance.core.state.DatLinkState
import com.metaglance.core.state.DatPermission
import com.metaglance.core.state.DatSession
import com.metaglance.core.state.DatSnapshot
import com.metaglance.core.state.DatStream
import com.metaglance.core.state.HapticPatterns
import com.metaglance.core.state.MotionFlow
import com.metaglance.core.state.NativeError
import com.metaglance.core.state.NativeErrors
import com.metaglance.core.state.StateMapper
import com.metaglance.core.state.StopCause
import com.metaglance.core.state.StopCauses
import com.metaglance.core.state.StopFacts
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import okhttp3.OkHttpClient

/**
 * Connects the glasses, the server, and the page. The app holds one instance, so a new activity keeps the session.
 *
 * Two sessions exist. The server session holds the cart, and the app keeps it until the server ends it.
 * The DAT session holds the camera stream. A stopped DAT session is final, so one server session can see many
 * of them: after a rest, a closed hinge, or a lost link.
 *
 * Call each function on the main thread. `scope` must use the main dispatcher. The controller holds no cart
 * logic and no prices: it moves messages, and it decides when the camera runs.
 *
 * The motion samples arrive on the motion thread of `DatLink`. `HeadInput` takes them there, and its answer goes
 * to the main thread.
 */
class SessionController(
    private val app: Application,
    private val scope: CoroutineScope,
    val dat: DatLink,
    val store: ProfileStore,
    private val vibrate: (LongArray) -> Unit
) {
    private val main = Handler(Looper.getMainLooper())
    private val audio = app.getSystemService(AudioManager::class.java)

    // A dead link gives no close frame. With the ping, the socket fails within about 20 seconds.
    private val client = OkHttpClient.Builder().pingInterval(PING_SECONDS, TimeUnit.SECONDS).build()
    private val scheduler = Scheduler { delayMs, block ->
        val task = Runnable(block)
        main.postDelayed(task, delayMs)
        return@Scheduler { main.removeCallbacks(task) }
    }

    // The motion thread and the frame thread read the profile.
    @Volatile
    private var profile: Profile = store.profile
    private var serverSession: StoredSession? = store.serverSession

    // The frame thread reads the socket.
    @Volatile
    private var socket: DeviceSocket? = null
    private var socketOpen = false
    private var closeSocketJob: Job? = null

    /** `debugDropSocket` sets it. No socket opens before this time. */
    private var socketBlockedUntilMs = 0L
    private var phoneOnline = true
    private var pocketOn = false

    private val voice = PhoneVoice(app)
    private val player = ExoLinePlayer(app, voice) { url -> api().clipUrl(url) }
    private val prompts = PromptTracker()
    private val speech = SpeechQueue(
        player = player,
        soundOff = { audio.getStreamVolume(AudioManager.STREAM_MUSIC) == 0 },
        rate = { profile.speechRate },
        nowMs = SystemClock::elapsedRealtime,
        onPromptDone = ::onPromptDone,
        onPromptStart = { prompts.onLineStart(it, SystemClock.elapsedRealtime()) }
    )
    private val announcer = ConnectionAnnouncer()
    private val paymentConfirm = PaymentConfirm()
    private var stillPolicy = StillPolicy()
    private var waitingStills = WaitingStills()
    private val answerSound = AnswerSound(app)
    private val answerSoundOnce = AnswerSoundOnce()
    private val motionRecorder = MotionRecorder(File(app.getExternalFilesDir("probe") ?: File(app.filesDir, "probe"), "motion"), scope, ::log)
    private val headTrace = HeadTrace()

    /** The number of the last upload. The frames of the stream and the stills share it, on two threads. */
    private val uploadSeq = AtomicInteger()

    // The motion thread and the frame thread read it.
    @Volatile
    private var headInput = newHeadInput()

    private var page: ((NativeToPage) -> Unit)? = null
    private var activity: MainActivity? = null

    /** True between `dat.startSession` and the state `STOPPED` of that DAT session. */
    private var datRunning = false
    private var starting = false
    private var stopByApp = false
    private var stopCalled = false
    private var sawStreaming = false
    private val sessionErrors = HashSet<String>()
    private val streamErrors = HashSet<String>()
    private var pipelineJob: Job? = null

    /** The pipeline of the running stream. The frame thread sets it, and the main thread gives it a `still.request`. */
    @Volatile
    private var framePipeline: FramePipeline? = null
    private var mainYesJob: Job? = null
    private var mainYesResolved = false
    private var waitingForGlasses = false
    private var restartsInARow = 0
    private var restartNotBeforeMs = 0L

    /** Counts the starts and the stops that the app asked for. A stop that waits for its cause reads it. */
    private var stopTicket = 0
    private var lastDeviceState: DeviceState? = null

    /**
     * Sees each message between the app and the server. The instrumented tests read the traffic through it.
     * The controller calls it on the main thread and on the frame thread, and it changes nothing.
     */
    interface Tap {
        /** `sent` is false when the socket was down, so the message went nowhere. */
        fun onToServer(message: DeviceToServer, sent: Boolean)

        fun onFrame(header: FrameHeader, jpegBytes: Int, sent: Boolean)

        fun onFromServer(message: ServerToDevice)

        /** An error event of the app itself, which goes to the page and not to the server. */
        fun onNativeError(error: NativeError)

        /** A line of the app itself, which the phone voice speaks. */
        fun onLocalLine(text: String)
    }

    @Volatile
    var tap: Tap? = null

    private val _nativeState = MutableStateFlow(mapNativeState(dat.snapshot.value))
    val nativeState: StateFlow<NativeState> = _nativeState.asStateFlow()

    init {
        watchPhoneNetwork()
        scope.launch { dat.snapshot.collect { onDatSnapshot(it) } }
        scope.launch { dat.faults.collect { onDatFault(it) } }
        // Runs on the motion thread, for each sample. The answer goes to the main thread.
        dat.headSink = { sample: HeadSample, arrivalMs: Long ->
            headInput.onSample(sample, arrivalMs, profile)?.let { intent -> main.post { onHeadAnswer(intent) } }
        }
        scope.launch {
            while (true) {
                delay(HEAD_TICK_MS)
                onHeadTick()
            }
        }
        // The answer of the touchpad carries the last finished prompt, and the server decides if it counts.
        scope.launch { dat.touches.collect { send(TouchInput.intentFor(it, prompts.lastFinishedPromptId())) } }
        // The server maps the words to intents. A result while a line plays is the line itself, not the shopper.
        scope.launch {
            dat.transcripts.collect { transcript ->
                VoiceInput.onTranscript(transcript, speech.isMuted(SystemClock.elapsedRealtime()))?.let { send(it) }
            }
        }
        scope.launch {
            while (true) {
                delay(TICK_MS)
                announcer.onTick(SystemClock.elapsedRealtime())?.let { line ->
                    tap?.onLocalLine(line)
                    speech.sayLocal(line)
                }
            }
        }
    }

    fun attachPage(send: (NativeToPage) -> Unit, activity: MainActivity) {
        // The payment prompt belongs to the old activity, and its outcome can get lost with that activity.
        if (this.activity !== activity) abandonPaymentPrompt()
        page = send
        this.activity = activity
        // A new activity has a new page, and that page is not in pocket mode.
        pocketOn = false
        refreshScreen()
    }

    /** A new activity can attach before the old one is destroyed. So only the attached activity detaches. */
    fun detachPage(activity: MainActivity) {
        if (this.activity !== activity) return
        abandonPaymentPrompt()
        page = null
        this.activity = null
    }

    fun onPageMessage(message: PageToNative) {
        when (message) {
            is PageToNative.UiReady -> onUiReady()
            is PageToNative.SessionStart -> startFromPage()
            is PageToNative.SessionEnd -> {
                send(DeviceToServer.Intent(IntentKind.STOP, IntentSource.PHONE))
                stopDat()
            }
            is PageToNative.Intent -> {
                // The question of the shopper comes through the microphone of the glasses.
                if (message.kind == IntentKind.ASK) requestMicrophone()
                send(DeviceToServer.Intent(message.kind, IntentSource.PHONE, message.promptId))
            }
            is PageToNative.CartEdit -> send(DeviceToServer.CartEdit(message.productId, message.qty))
            is PageToNative.ProfileSet -> onProfilePatch(message.patch)
            is PageToNative.DataDelete -> deleteData()
            is PageToNative.SetupRegister -> setupRegister()
            is PageToNative.SetupRequestCamera -> setupRequestCamera()
            is PageToNative.SetupOpenUpdate -> activity?.let(dat::openUpdate)
            is PageToNative.PocketSet -> {
                pocketOn = message.on
                activity?.setPocket(message.on)
                refreshScreen()
            }
            // Kotlin never vibrates by itself: the page selects each pattern.
            is PageToNative.Haptic -> if (profile.haptics) vibrate(HapticPatterns.timings(message.pattern))
        }
    }

    /**
     * A press of a volume key. Returns true when the key was an answer to the current prompt, so the caller must
     * not change the volume. Up is a yes, and down is a no.
     */
    fun onVolumeKey(up: Boolean): Boolean {
        val promptId = prompts.currentPromptId()
        val kind = KeyInput.intentFor(up, profile.mainYes, promptId) ?: return false
        send(DeviceToServer.Intent(kind, IntentSource.KEY, promptId))
        return true
    }

    /** Sends an `error` event to the page. The activity uses it for a failure that it sees itself. */
    fun reportError(error: NativeError) = sendError(error)

    /** Stops the camera stream, as `session.rest` of the server does. The server session and the socket stay. */
    fun stopCamera() = stopDat()

    /** Makes the detector read the stored sensitivity again. The head window of an open prompt starts again. */
    fun applySensitivity() {
        headInput.close()
        headInput = newHeadInput()
    }

    /**
     * Closes the socket, and connects again only after `forMs`. For the mock menu and the tests: it is the state
     * "Server not reachable" with no change to the network of the phone.
     */
    fun debugDropSocket(forMs: Long) {
        val dropped = socket
        if (dropped == null) {
            log("debug drop: no socket")
            return
        }
        log("debug drop: the socket stays closed for $forMs ms")
        val nowMs = SystemClock.elapsedRealtime()
        socketBlockedUntilMs = nowMs + forMs
        closeSocketJob?.cancel()
        closeSocketJob = null
        dropped.close()
        socket = null
        socketOpen = false
        announcer.onSocketDown(nowMs)
        refreshNativeState()
        scope.launch {
            delay(forMs)
            if (socket == null && serverSession?.live == true) openSocket()
        }
    }

    private fun setupRegister() {
        val activity = activity ?: return
        if (dat.ready) {
            dat.register(activity)
            return
        }
        // The SDK does not run yet, because the Bluetooth permission is missing. The activity asks for it again.
        activity.requestBluetooth { granted ->
            when {
                !granted -> sendError(NativeErrors.BLUETOOTH_DENIED)
                dat.ready -> dat.register(activity)
                else -> sendError(NativeErrors.REGISTRATION_FAILED)
            }
        }
    }

    private fun setupRequestCamera() {
        val activity = activity ?: return
        if (dat.ready) {
            activity.requestCameraPermission()
        } else {
            sendError(if (dat.snapshot.value.bluetoothGranted) NativeErrors.PERMISSION_FAILED else NativeErrors.BLUETOOTH_DENIED)
        }
    }

    private fun onUiReady() {
        toPage(NativeToPage.NativeStateChanged(_nativeState.value))
        toPage(NativeToPage.ProfileChanged(profile))
        val session = serverSession?.takeIf { it.live } ?: return
        scope.launch {
            val snapshot = try {
                withContext(Dispatchers.IO) { api().snapshot(session.sessionId, session.token) }
            } catch (e: IOException) {
                log("snapshot failed: ${e.message}")
                return@launch
            }
            toPage(NativeToPage.Snapshot(snapshot))
        }
    }

    private fun startFromPage() {
        if (datRunning || starting) {
            log("session.start: a session runs")
            return
        }
        val snapshot = dat.snapshot.value
        val device = snapshot.device
        // MockDeviceKit does not use Bluetooth.
        val failure = when {
            !snapshot.bluetoothGranted && !snapshot.mock -> NativeErrors.BLUETOOTH_DENIED
            device == null || device.link != DatLinkState.CONNECTED -> NativeErrors.NO_DEVICE
            device.don == DatDon.DOFFED -> NativeErrors.NOT_WORN
            else -> null
        }
        if (failure != null) {
            sendError(failure)
            return
        }
        waitingForGlasses = false
        restartsInARow = 0
        starting = true
        scope.launch {
            try {
                if (ensureServerSession()) startDat()
            } finally {
                starting = false
            }
        }
    }

    /** Creates a server session if none is live, and opens its socket. Returns false after a failure. */
    private suspend fun ensureServerSession(): Boolean {
        var live = serverSession?.takeIf { it.live }
        // With the socket down, the stored session can be one that the server does not hold: the server started
        // again, or it removed the session. Such a socket never opens, so the app asks first.
        if (live != null && !socketOpen && !serverHolds(live)) {
            log("server session ${live.sessionId} did not answer, so a new one starts")
            live = null
        }
        if (live == null) {
            val created = try {
                withContext(Dispatchers.IO) { api().createSession(profile) }
            } catch (e: IOException) {
                log("create session failed: ${e.message}")
                sendError(NativeErrors.SERVER_UNREACHABLE)
                return false
            }
            // The socket of an ended session can still be open, because it closes with a delay.
            closeSocket()
            prompts.reset()
            saveServerSession(StoredSession(created.sessionId, created.token, created.wsUrl, live = true))
            log("server session ${created.sessionId}")
        }
        openSocket()
        return true
    }

    private suspend fun serverHolds(session: StoredSession): Boolean = try {
        withContext(Dispatchers.IO) { api().snapshot(session.sessionId, session.token) }
        true
    } catch (_: IOException) {
        false
    }

    private fun openSocket() {
        if (socket != null || SystemClock.elapsedRealtime() < socketBlockedUntilMs) return
        val session = serverSession ?: return
        val url = try {
            api().socketUrl(session.wsUrl)
        } catch (e: IllegalArgumentException) {
            log("the socket address of the server is not an address: ${e.message}")
            return
        }
        lateinit var created: DeviceSocket
        // The listener runs on a thread of OkHttp. A call of a socket that this controller closed changes nothing.
        val listener = object : DeviceSocket.Listener {
            override fun onOpen() = onMain { onSocketOpen() }

            override fun onMessage(message: ServerToDevice) = onMain { onServerMessage(message) }

            override fun onDown() = onMain { onSocketDown() }

            private fun onMain(block: () -> Unit) {
                main.post { if (socket === created) block() }
            }
        }
        created = DeviceSocket(client, url, scheduler, listener, log = ::log)
        socket = created
        created.connect()
        refreshNativeState()
    }

    private fun closeSocket() {
        closeSocketJob?.cancel()
        closeSocketJob = null
        socket?.close()
        socket = null
        socketOpen = false
        // A socket that the app closed is not a lost connection, so the announcer starts again.
        announcer.onSocketOpen()
        refreshNativeState()
    }

    private fun onSocketOpen() {
        log("socket open")
        socketOpen = true
        announcer.onSocketOpen()
        refreshNativeState()
        val state = StateMapper.deviceState(dat.snapshot.value)
        lastDeviceState = state
        send(DeviceToServer.DeviceStateChanged(state))
    }

    private fun onSocketDown() {
        log("socket down")
        // The server can close the socket of a session that it ended. That is not a lost connection:
        // no new connection follows, and the "Connection lost" line stays unsaid.
        if (serverSession?.live != true) {
            closeSocket()
            return
        }
        socketOpen = false
        announcer.onSocketDown(SystemClock.elapsedRealtime())
        refreshNativeState()
    }

    private fun onServerMessage(message: ServerToDevice) {
        tap?.onFromServer(message)
        when (message) {
            is ServerToDevice.Speak -> {
                message.promptId?.let { prompts.onPromptSpoken(it, SystemClock.elapsedRealtime()) }
                // The answer sound of a head gesture already played, so the line that answers it plays its clip alone.
                speech.onSpeak(message.copy(sound = answerSoundOnce.lineSound(message.sound, SystemClock.elapsedRealtime())))
            }
            is ServerToDevice.Event -> {
                toPage(NativeToPage.Event(message.event))
                val event = Codec.decodeServerEvent(message.event)
                event?.let(prompts::onEvent)
                // The checkout ended on the server, for example after 30 seconds with no kiosk code in view.
                if (event is ServerEvent.CheckoutCancelled) closePaymentPrompt()
                if (event is ServerEvent.GlanceAmbiguous) wantStill(WaitingStill.SECOND_LOOK)
            }
            is ServerToDevice.Snapshot -> {
                toPage(NativeToPage.Snapshot(message.session))
                profileOf(message.session)?.let { setProfile(it) }
            }
            // The cart stays on the server, and the socket stays open. The next start makes a new DAT session.
            is ServerToDevice.SessionRest -> stopDat()
            is ServerToDevice.SessionEnd -> onServerSessionEnd()
            is ServerToDevice.BiometricRequest -> onBiometricRequest()
            is ServerToDevice.StillRequest -> when (message.purpose) {
                // The frame path owns the limit for label stills, so the request goes through it.
                StillPurpose.LABEL -> framePipeline?.requestLabelStill() ?: log("still.request: no stream")
                StillPurpose.REFERENCE -> wantStill(WaitingStill.REFERENCE)
            }
        }
    }

    /** The server asks for it before a payment above 50 EUR. Each request gets one `biometric.result`. */
    private fun onBiometricRequest() {
        val activity = activity
        if (activity == null) {
            log("biometric.request: no screen shows the prompt")
            send(DeviceToServer.BiometricResult(false))
            return
        }
        when (paymentConfirm.onRequest(activity.paymentAvailable())) {
            PaymentConfirm.Start.SHOW -> activity.confirmPayment(::onPaymentOutcome)
            PaymentConfirm.Start.ALREADY_OPEN -> log("biometric.request: the prompt is open")
            PaymentConfirm.Start.UNAVAILABLE -> {
                send(DeviceToServer.BiometricResult(false))
                sendError(NativeErrors.BIOMETRIC_UNAVAILABLE)
            }
        }
    }

    private fun onPaymentOutcome(outcome: PromptOutcome) {
        val ok = paymentConfirm.onOutcome(outcome) ?: return
        log("payment prompt: ok=$ok")
        send(DeviceToServer.BiometricResult(ok))
    }

    /** Closes an open payment prompt. The prompt then reports an error, and the app sends `ok: false`. */
    private fun closePaymentPrompt() {
        if (paymentConfirm.open) activity?.cancelPayment()
    }

    /** Answers an open payment prompt with `ok: false` now, because its activity goes away. */
    private fun abandonPaymentPrompt() {
        if (!paymentConfirm.open) return
        activity?.cancelPayment()
        onPaymentOutcome(PromptOutcome.ERROR)
    }

    private fun onServerSessionEnd() {
        closePaymentPrompt()
        stopDat()
        // The ID and the token stay for data.delete.
        serverSession?.let { saveServerSession(StoredSession(it.sessionId, it.token, it.wsUrl, live = false)) }
        refreshNativeState()
        val ended = socket
        closeSocketJob?.cancel()
        closeSocketJob = scope.launch {
            // The last lines of the server still arrive in this time.
            delay(CLOSE_AFTER_END_MS)
            if (socket === ended) closeSocket()
        }
    }

    private fun onPromptDone(promptId: String) {
        prompts.onPromptDone(promptId, SystemClock.elapsedRealtime())
        send(DeviceToServer.PromptDone(promptId))
    }

    private fun onProfilePatch(patch: JsonObject) {
        val patched = Profiles.applyPatch(profile, patch)
        // The page gets an answer to each patch, also to one that changes nothing, so it never shows a value
        // that the app did not take.
        if (patched == profile) toPage(NativeToPage.ProfileChanged(profile)) else setProfile(patched)
        send(DeviceToServer.ProfileSet(patch))
        // The selection of the shopper changes only when the profile holds the value of the patch.
        if (patch["mainYes"] == GlanceJson.encodeToJsonElement(MainYes.serializer(), patched.mainYes)) {
            store.wantedMainYes = patched.mainYes
            if (patched.mainYes == MainYes.VOICE) requestMicrophone()
            // The shopper can select an input that does not work on these glasses.
            if (mainYesResolved) resolveMainYes()
        }
    }

    /**
     * Asks for the microphone permission of the glasses when a session can use Speech and the permission is
     * missing. The bridge has no message for it, so the selection of the voice and the intent `ask` start it.
     */
    private fun requestMicrophone() {
        if (!dat.ready || !dat.usesSpeech || dat.snapshot.value.microphonePermission == DatPermission.GRANTED) return
        activity?.requestMicrophonePermission()
    }

    private fun setProfile(value: Profile) {
        if (value == profile) return
        profile = value
        store.profile = value
        toPage(NativeToPage.ProfileChanged(value))
    }

    private fun profileOf(session: JsonObject): Profile? {
        val json = session["profile"] ?: return null
        return try {
            GlanceJson.decodeFromJsonElement(Profile.serializer(), json)
        } catch (_: SerializationException) {
            null
        } catch (_: IllegalArgumentException) {
            null
        }
    }

    private fun deleteData() {
        stopTicket += 1
        waitingForGlasses = false
        closePaymentPrompt()
        stopDat()
        val session = serverSession
        closeSocket()
        speech.clear()
        prompts.reset()
        store.clear()
        serverSession = null
        profile = store.profile
        toPage(NativeToPage.ProfileChanged(profile))
        refreshNativeState()
        toPage(NativeToPage.NativeStateChanged(_nativeState.value))
        if (session == null) return
        scope.launch {
            try {
                withContext(Dispatchers.IO) { api().deleteSession(session.sessionId, session.token) }
            } catch (e: IOException) {
                log("delete session failed: ${e.message}")
            }
        }
    }

    private fun startDat() {
        if (datRunning) return
        stopTicket += 1
        sessionErrors.clear()
        streamErrors.clear()
        stopByApp = false
        stopCalled = false
        sawStreaming = false
        mainYesResolved = false
        headInput.close()
        headInput = newHeadInput()
        waitingStills = WaitingStills()
        // The mock menu can change the two times. Each camera start reads them again.
        val labelTiming = store.labelTiming
        stillPolicy = StillPolicy(labelTiming.stillEveryMs)
        log("label still: wait ${labelTiming.waitMs} ms, gap ${labelTiming.gapMs} ms")
        // The same holds for the stream settings. DatLink reads them in the call below.
        val stream = store.streamSetup
        if (!dat.startSession(withCamera = true, autoAttach = true)) {
            // The SDK error of a failed start arrives through dat.faults, after this call returns.
            scope.launch { sendError(if (INSUFFICIENT_SDK in sessionErrors) NativeErrors.SDK_TOO_OLD else NativeErrors.SESSION_FAILED) }
            return
        }
        datRunning = true
        refreshScreen()
        startPipeline(labelTiming, stream)
    }

    /** Stops the DAT session because the app, the page, or the server asked for it. No error event follows. */
    private fun stopDat() {
        stopTicket += 1
        waitingForGlasses = false
        if (!datRunning) return
        stopByApp = true
        stopCalled = true
        dat.stopSession()
    }

    private fun startPipeline(labelTiming: LabelTiming, stream: StreamSetup) {
        pipelineJob?.cancel()
        // The frame work runs on one background thread. dat.frames keeps only the newest frame, so nothing queues.
        pipelineJob = scope.launch(Dispatchers.Default.limitedParallelism(1)) {
            val faces = FaceFinder()
            val pipeline = FramePipeline(
                gate = {
                    val link = socket
                    UploadGate.check(link?.isOpen == true, link?.queuedBytes() ?: 0, worn(dat.snapshot.value))
                },
                onKioskText = { text ->
                    val message = DeviceToServer.KioskSeen(text)
                    val sent = socket?.send(message) == true
                    tap?.onToServer(message, sent)
                },
                onBarcode = { read ->
                    val message = DeviceToServer.BarcodeSeen(read.code, read.source)
                    val sent = socket?.send(message) == true
                    tap?.onToServer(message, sent)
                },
                onLabelStill = { main.post(::takeLabelStill) },
                onUpload = { header, jpeg ->
                    val sent = socket?.sendFrame(header, jpeg) == true
                    tap?.onFrame(header, jpeg.size, sent)
                },
                // Each upload is the center of the frame, with each face pixelated.
                findFaces = { faces.find(it) },
                crop = true,
                nextSeq = uploadSeq::incrementAndGet,
                label = labelTiming.labelPolicy(stream.gapMs(LabelPolicy.DEFAULT_GAP_MS)),
                holdStills = { holdsStills(SystemClock.elapsedRealtime()) },
                stream = stream,
                log = ::log
            )
            framePipeline = pipeline
            try {
                dat.frames.collect { pipeline.onFrame(it) }
            } finally {
                // The pipeline of a new stream can be there already.
                if (framePipeline === pipeline) framePipeline = null
                pipeline.close()
                faces.close()
            }
        }
    }

    /**
     * A nod or a shake that the detector took as the answer to a prompt. The sound tells the shopper at once.
     * A line of the prompt that still plays stops, so the line of the server that answers the gesture is next.
     */
    private fun onHeadAnswer(intent: DeviceToServer.Intent) {
        val yes = intent.kind == IntentKind.YES
        val nowMs = SystemClock.elapsedRealtime()
        val promptId = intent.promptId
        val sinceLine = promptId?.let(prompts::lineStartMs)?.let { "${nowMs - it} ms" } ?: "no time"
        val sinceCandidate = headTrace.firstCandidateMs?.let { "${nowMs - it} ms" } ?: "no time"
        log("head answer ${if (yes) "yes" else "no"}: prompt $promptId, $sinceLine after the start of its line, $sinceCandidate after the first candidate")
        if (send(intent) && answerSound.play(yes)) {
            answerSoundOnce.onAnswerSound(if (yes) SoundName.ADDED else SoundName.REMOVED, nowMs)
        }
        if (promptId != null && speech.stopPrompt(promptId)) {
            // The prompt is finished for the phone. The server gets no `prompt.done`: it already has the answer.
            prompts.onPromptDone(promptId, nowMs)
            log("prompt line stopped: prompt $promptId")
        }
    }

    /**
     * Tells the head input when no motion sample can arrive: in a stall of the link, and while the glasses take
     * a still. The time of a head window does not run then. It also starts a still that waited for a prompt.
     */
    private fun onHeadTick() {
        if (!datRunning) return
        val nowMs = SystemClock.elapsedRealtime()
        val health = dat.motionHealth
        val stalledSinceMs = health.stalledSinceMs.takeIf { health.flow == MotionFlow.STALLED }
        val input = headInput
        input.setBlocked(stalledSinceMs != null || dat.stillRunning, stalledSinceMs ?: nowMs, profile)
        input.onTick(nowMs, profile)
        if (dat.stillRunning || holdsStills(nowMs)) return
        waitingStills.next(nowMs) { log("${it.label} still dropped: it waited too long for a prompt") }?.let(::startStill)
    }

    /** True while a prompt waits for a head answer. A still stalls the motion samples, so none starts then. */
    private fun holdsStills(nowMs: Long): Boolean = headInput.holdsStills(nowMs, profile)

    /** Starts a still now, or keeps it until the prompt that waits for a head answer has its answer. */
    private fun wantStill(still: WaitingStill) {
        val nowMs = SystemClock.elapsedRealtime()
        if (datRunning && holdsStills(nowMs)) {
            waitingStills.add(still, nowMs)
            log("${still.label} still waits: a prompt waits for its answer")
            return
        }
        startStill(still)
    }

    private fun startStill(still: WaitingStill) = when (still) {
        WaitingStill.SECOND_LOOK -> takeStill()
        WaitingStill.REFERENCE -> takeReferenceStill()
    }

    private val WaitingStill.label: String get() = if (this == WaitingStill.REFERENCE) "reference" else "second look"

    /**
     * The sharp second look: the server cannot tell look-alike products apart in a frame of the stream, so the
     * app sends one still photo, which has more pixels. The contract has no request for it, and the event
     * `glance.ambiguous` is the signal. A still does not pass the upload gate, but it needs an open socket.
     */
    private fun takeStill() {
        val eventMs = SystemClock.elapsedRealtime()
        // Each DAT session has a policy of its own, and a capture ends the policy that started it.
        val policy = stillPolicy
        if (!datRunning || !policy.tryStart(eventMs)) return
        scope.launch {
            try {
                val photo = dat.captureStill() ?: return@launch
                val capturedAt = System.currentTimeMillis()
                val still = withContext(Dispatchers.Default) {
                    val faces = FaceFinder()
                    try {
                        StillPhoto.prepare(photo) { faces.find(it) }
                    } finally {
                        faces.close()
                    }
                }
                if (still == null) {
                    log("still dropped: face detection failed")
                    return@launch
                }
                val header = FrameHeader(uploadSeq.incrementAndGet(), capturedAt, still.width, still.height, blurred = true, kind = FrameKind.STILL)
                val sent = socket?.sendFrame(header, still.jpeg) == true
                tap?.onFrame(header, still.jpeg.size, sent)
                val result = if (sent) "sent" else "not sent, the socket is down"
                log("still seq=${header.seq} ${still.width}x${still.height} ${still.jpeg.size} bytes $result, ${SystemClock.elapsedRealtime() - eventMs} ms after the event")
            } finally {
                policy.onEnd()
            }
        }
    }

    /**
     * The last way to read a barcode: one still photo, which has more pixels than a frame. `LabelPolicy` in the
     * frame path asks for it, after a barcode region stayed in view with no code, or after a `still.request` of
     * the server. This still and the still of the sharp second look share one `StillPolicy`. The phone reads the
     * still first. Only a still with no code goes to the server, as a frame of the kind `label`.
     */
    private fun takeLabelStill() {
        val startMs = SystemClock.elapsedRealtime()
        if (datRunning && holdsStills(startMs)) {
            // A prompt started after the frame path asked. The request stays for the first frame after the answer.
            log("label still waits: a prompt waits for its answer")
            framePipeline?.requestLabelStill()
            return
        }
        val policy = stillPolicy
        if (!datRunning || !policy.tryStart(startMs)) {
            log(if (datRunning) "label still dropped: the last still is too new" else "label still dropped: no stream")
            return
        }
        scope.launch {
            try {
                val photo = dat.captureStill() ?: return@launch
                val capturedAt = System.currentTimeMillis()
                val size = "${photo.width}x${photo.height}"
                val outcome = withContext(Dispatchers.Default) { readLabelStill(photo) }
                val took = "${SystemClock.elapsedRealtime() - startMs} ms"
                when (outcome) {
                    is LabelOutcome.Code -> {
                        log("label still $size: code ${outcome.read.code} ${outcome.read.source.name.lowercase()}, $took")
                        send(DeviceToServer.BarcodeSeen(outcome.read.code, outcome.read.source))
                        framePipeline?.onLabelStillCode()
                    }
                    is LabelOutcome.Upload -> {
                        val still = outcome.still
                        val header = FrameHeader(uploadSeq.incrementAndGet(), capturedAt, still.width, still.height, blurred = true, kind = FrameKind.LABEL)
                        val sent = socket?.sendFrame(header, still.jpeg) == true
                        tap?.onFrame(header, still.jpeg.size, sent)
                        val result = if (sent) "sent" else "not sent, the socket is down"
                        log("label still $size: no code, seq=${header.seq} ${still.width}x${still.height} ${still.jpeg.size} bytes $result, $took")
                    }
                    LabelOutcome.Dropped -> log("label still $size dropped: face detection failed, $took")
                }
            } finally {
                policy.onEnd()
            }
        }
    }

    /**
     * A reference picture of a store item: a person holds the product up and asks the server for it. The still
     * does not wait for the limits of a label still, and the phone reads no code in it, because the server wants
     * the picture also when the barcode is in view. Each face is pixelated, as in each other upload.
     */
    private fun takeReferenceStill() {
        val startMs = SystemClock.elapsedRealtime()
        val policy = stillPolicy
        if (!datRunning || !policy.tryStartNow(startMs)) {
            log(if (datRunning) "reference still dropped: a still runs" else "reference still dropped: no stream")
            return
        }
        scope.launch {
            try {
                val photo = dat.captureStill() ?: return@launch
                val capturedAt = System.currentTimeMillis()
                val still = withContext(Dispatchers.Default) {
                    val faces = FaceFinder()
                    try {
                        StillPhoto.prepareLabel(photo) { faces.find(it) }
                    } finally {
                        faces.close()
                    }
                }
                if (still == null) {
                    log("reference still dropped: face detection failed")
                    return@launch
                }
                val header = FrameHeader(uploadSeq.incrementAndGet(), capturedAt, still.width, still.height, blurred = true, kind = FrameKind.LABEL)
                val sent = socket?.sendFrame(header, still.jpeg) == true
                tap?.onFrame(header, still.jpeg.size, sent)
                val result = if (sent) "sent" else "not sent, the socket is down"
                log("reference still seq=${header.seq} ${still.width}x${still.height} ${still.jpeg.size} bytes $result, ${SystemClock.elapsedRealtime() - startMs} ms")
            } finally {
                policy.onEnd()
            }
        }
    }

    private fun readLabelStill(photo: Bitmap): LabelOutcome {
        val scanner = CodeScanner()
        val digits = DigitReader()
        val faces = FaceFinder()
        try {
            return LabelStill.read(photo, { scanner.scan(it) }, { digits.read(it) }, { faces.find(it) })
        } finally {
            scanner.close()
            digits.close()
            faces.close()
        }
    }

    private fun worn(snapshot: DatSnapshot): Boolean? = StateMapper.deviceState(snapshot).worn

    private fun onDatSnapshot(snapshot: DatSnapshot) {
        refreshNativeState()
        val state = StateMapper.deviceState(snapshot)
        if (state != lastDeviceState) {
            lastDeviceState = state
            if (socketOpen) send(DeviceToServer.DeviceStateChanged(state))
        }
        if (datRunning) {
            if (snapshot.stream == DatStream.STREAMING && !sawStreaming) onFirstStreaming()
            // A capability can start late: Speech starts when the shopper allows the microphone during a session.
            // Then the input that the shopper selected can work now.
            if (mainYesResolved && snapshot.stream == DatStream.STREAMING && profile.mainYes != store.wantedMainYes) resolveMainYes()
            // A stream that ended by itself cannot start again, and its DAT session has no other use.
            val streamEnded = snapshot.stream == DatStream.STOPPED || snapshot.stream == DatStream.CLOSED
            if (sawStreaming && streamEnded && !stopCalled) {
                stopCalled = true
                dat.stopSession()
            }
            if (snapshot.session == DatSession.STOPPED) onDatStopped(snapshot)
        } else if (waitingForGlasses) {
            restartWhenReady(snapshot)
        }
    }

    private fun onFirstStreaming() {
        sawStreaming = true
        restartsInARow = 0
        mainYesJob?.cancel()
        mainYesJob = scope.launch {
            // Motion, Inputs, and Speech start after the stream. This time lets each one report its state.
            delay(MAIN_YES_DELAY_MS)
            mainYesResolved = true
            resolveMainYes()
        }
    }

    private fun resolveMainYes() {
        val snapshot = dat.snapshot.value
        val works = MainYesResolver.resolve(store.wantedMainYes, snapshot.motionStarted, snapshot.inputsActive, snapshot.speechStarted)
        if (works == profile.mainYes) return
        val wanted = store.wantedMainYes
        log(if (works == wanted) "main yes: $wanted works now" else "main yes: $wanted does not work on these glasses, so it is $works")
        val patch = buildJsonObject { put("mainYes", GlanceJson.encodeToJsonElement(MainYes.serializer(), works)) }
        setProfile(Profiles.applyPatch(profile, patch))
        send(DeviceToServer.ProfileSet(patch))
    }

    private fun onDatFault(fault: DatFault) {
        when (fault.area) {
            DatFault.Area.SESSION -> sessionErrors.add(fault.name)
            DatFault.Area.STREAM -> streamErrors.add(fault.name)
            // The page reads "no internet" from `network`. A missing Meta AI app is in `metaAiInstalled`.
            DatFault.Area.REGISTRATION -> if (fault.name in REGISTRATION_FAILURES) sendError(NativeErrors.REGISTRATION_FAILED)
            else -> Unit
        }
    }

    private fun onDatStopped(snapshot: DatSnapshot) {
        datRunning = false
        headInput.close()
        refreshScreen()
        pipelineJob?.cancel()
        pipelineJob = null
        mainYesJob?.cancel()
        mainYesJob = null
        if (stopByApp) {
            onStopCause(StopFacts(true, sessionErrors.toSet(), streamErrors.toSet(), snapshot.device?.link, snapshot.device?.hinge))
            return
        }
        // The session can stop before the device reports why. Mock glasses that fold report SESSION_ENDED_BY_DEVICE
        // and STOPPED first, and the closed hinge after them. So the cause is read a short time after the stop.
        val ticket = stopTicket
        scope.launch {
            delay(STOP_SETTLE_MS)
            // A new start, or a stop that the app asked for, came first. The old stop has no use then.
            if (ticket != stopTicket || datRunning) return@launch
            val device = dat.snapshot.value.device
            onStopCause(StopFacts(false, sessionErrors.toSet(), streamErrors.toSet(), device?.link, device?.hinge))
        }
    }

    private fun onStopCause(facts: StopFacts) {
        val cause = StopCauses.classify(facts)
        log("dat session stopped: $cause session=$sessionErrors stream=$streamErrors")
        val error = if (cause == StopCause.OTHER && INSUFFICIENT_SDK in sessionErrors) NativeErrors.SDK_TOO_OLD else NativeErrors.forStop(cause)
        error?.let(::sendError)
        if (StopCauses.autoRestart(cause) && serverSession?.live == true && restartsInARow < MAX_RESTARTS_IN_A_ROW) {
            waitingForGlasses = true
            restartNotBeforeMs = SystemClock.elapsedRealtime() + RESTART_DELAY_MS
            // The glasses can be ready at once, and then no new snapshot arrives.
            scope.launch {
                delay(RESTART_DELAY_MS)
                if (waitingForGlasses && !datRunning) restartWhenReady(dat.snapshot.value)
            }
        }
    }

    private fun restartWhenReady(snapshot: DatSnapshot) {
        if (SystemClock.elapsedRealtime() < restartNotBeforeMs || !StopCauses.canStartNow(snapshot.device)) return
        if (serverSession?.live != true) {
            waitingForGlasses = false
            return
        }
        waitingForGlasses = false
        restartsInARow += 1
        log("the glasses are ready again: new dat session, attempt $restartsInARow")
        openSocket()
        startDat()
    }

    /** Returns false when the socket is down, so the message went nowhere. */
    private fun send(message: DeviceToServer): Boolean {
        val sent = socket?.send(message) == true
        tap?.onToServer(message, sent)
        if (!sent) log("not sent, the socket is down: ${Codec.encode(message).take(MAX_LOGGED_CHARS)}")
        return sent
    }

    private fun sendError(error: NativeError) {
        log("error ${error.code}")
        tap?.onNativeError(error)
        toPage(NativeToPage.Event(NativeErrors.toEvent(error)))
    }

    private fun toPage(message: NativeToPage) {
        page?.invoke(message)
    }

    private fun refreshNativeState() {
        val state = mapNativeState(dat.snapshot.value)
        if (state == _nativeState.value) return
        _nativeState.value = state
        toPage(NativeToPage.NativeStateChanged(state))
    }

    private fun mapNativeState(snapshot: DatSnapshot): NativeState = StateMapper.nativeState(snapshot, phoneOnline, socketExpected = serverSession?.live == true, socketOpen = socketOpen)

    private fun saveServerSession(session: StoredSession) {
        serverSession = session
        store.serverSession = session
    }

    /** The screen stays on while a DAT session runs, and in pocket mode. */
    private fun refreshScreen() {
        val window = activity?.window ?: return
        if (datRunning || pocketOn) {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        } else {
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
    }

    private fun watchPhoneNetwork() {
        val connectivity = app.getSystemService(ConnectivityManager::class.java)
        phoneOnline = connectivity.activeNetwork != null
        connectivity.registerDefaultNetworkCallback(object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) = setPhoneOnline(true)

            override fun onLost(network: Network) = setPhoneOnline(false)

            // The system calls this object on a thread of its own.
            private fun setPhoneOnline(online: Boolean) {
                main.post {
                    phoneOnline = online
                    refreshNativeState()
                }
            }
        })
    }

    private fun newHeadInput(): HeadInput {
        val config = HeadGestureConfig.of(store.sensitivity, ProbeDecisions.PITCH_AXIS, ProbeDecisions.PITCH_DOWN_SIGN, ProbeDecisions.YAW_AXIS)
        // The detector gets samples only in a head window. So each line of it is about the answer to a prompt.
        return HeadInput(HeadGestureDetector(config, headTrace::onCandidate), prompts, headTrace)
    }

    /**
     * Logs each head window and each stroke pair of the detector. With "Record motion in sessions" of the mock
     * menu, it also gives the samples of the window to the recorder. `HeadInput` calls it, one call at a time.
     */
    private inner class HeadTrace : HeadWindowListener {
        private var samples = 0
        private var recording = false

        /** The phone time of the first stroke pair of the head window, accepted or rejected. The main thread reads it. */
        @Volatile
        var firstCandidateMs: Long? = null
            private set

        override fun onOpen(promptId: String, openMs: Long) {
            samples = 0
            firstCandidateMs = null
            recording = store.recordMotion
            log("head window open: prompt $promptId, in ${(openMs - SystemClock.elapsedRealtime()).coerceAtLeast(0)} ms")
            if (recording) motionRecorder.onOpen(promptId, openMs)
        }

        fun onCandidate(report: GestureReport) {
            if (firstCandidateMs == null) firstCandidateMs = SystemClock.elapsedRealtime()
            log(report.line())
        }

        override fun onSample(sample: HeadSample, arrivalMs: Long) {
            samples += 1
            if (recording) motionRecorder.onSample(sample, arrivalMs)
        }

        override fun onClose(promptId: String) {
            log("head window closed: prompt $promptId, $samples samples")
            if (recording) motionRecorder.onClose(promptId)
        }
    }

    // The server address is a setting, so each call reads it again.
    private fun api() = GlanceApi(client, store.serverUrl)

    private fun log(text: String) {
        Log.i(TAG, text)
    }

    private companion object {
        const val TAG = "Glance"
        const val PING_SECONDS = 10L
        const val TICK_MS = 1000L
        const val HEAD_TICK_MS = 100L
        const val CLOSE_AFTER_END_MS = 5000L
        const val MAIN_YES_DELAY_MS = 5000L
        const val RESTART_DELAY_MS = 2000L
        const val STOP_SETTLE_MS = 500L
        const val MAX_RESTARTS_IN_A_ROW = 5
        const val MAX_LOGGED_CHARS = 120
        const val INSUFFICIENT_SDK = "INSUFFICIENT_SDK_VERSION"

        /** The names of `RegistrationError` that mean a registration that did not work. */
        val REGISTRATION_FAILURES = setOf("FAILED_TO_REGISTER", "UNKNOWN")
    }
}
