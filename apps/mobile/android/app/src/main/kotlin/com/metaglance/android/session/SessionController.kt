package com.metaglance.android.session

import android.app.Application
import android.media.AudioManager
import android.net.ConnectivityManager
import android.net.Network
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.view.WindowManager
import com.metaglance.android.MainActivity
import com.metaglance.android.audio.ExoLinePlayer
import com.metaglance.android.audio.PhoneVoice
import com.metaglance.android.dat.DatLink
import com.metaglance.android.dat.ProbeDecisions
import com.metaglance.android.pipeline.FramePipeline
import com.metaglance.core.audio.SpeechQueue
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
import com.metaglance.core.contract.ServerToDevice
import com.metaglance.core.gesture.HeadGestureConfig
import com.metaglance.core.gesture.HeadGestureDetector
import com.metaglance.core.image.UploadGate
import com.metaglance.core.input.HeadInput
import com.metaglance.core.input.MainYesResolver
import com.metaglance.core.input.PromptTracker
import com.metaglance.core.net.DeviceSocket
import com.metaglance.core.net.GlanceApi
import com.metaglance.core.net.Scheduler
import com.metaglance.core.state.ConnectionAnnouncer
import com.metaglance.core.state.DatDon
import com.metaglance.core.state.DatFault
import com.metaglance.core.state.DatLinkState
import com.metaglance.core.state.DatSession
import com.metaglance.core.state.DatSnapshot
import com.metaglance.core.state.DatStream
import com.metaglance.core.state.NativeError
import com.metaglance.core.state.NativeErrors
import com.metaglance.core.state.StateMapper
import com.metaglance.core.state.StopCause
import com.metaglance.core.state.StopCauses
import com.metaglance.core.state.StopFacts
import java.io.IOException
import java.util.concurrent.TimeUnit
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
 */
class SessionController(
    private val app: Application,
    private val scope: CoroutineScope,
    val dat: DatLink,
    val store: ProfileStore
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

    private var profile: Profile = store.profile
    private var serverSession: StoredSession? = store.serverSession

    // The frame thread reads the socket.
    @Volatile
    private var socket: DeviceSocket? = null
    private var socketOpen = false
    private var closeSocketJob: Job? = null
    private var phoneOnline = true

    private val voice = PhoneVoice(app)
    private val player = ExoLinePlayer(app, voice) { url -> api().clipUrl(url) }
    private val prompts = PromptTracker()
    private val speech = SpeechQueue(
        player = player,
        soundOff = { audio.getStreamVolume(AudioManager.STREAM_MUSIC) == 0 },
        rate = { profile.speechRate },
        nowMs = SystemClock::elapsedRealtime,
        onPromptDone = ::onPromptDone
    )
    private val announcer = ConnectionAnnouncer()
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
    private var mainYesJob: Job? = null
    private var mainYesResolved = false
    private var waitingForGlasses = false
    private var restartsInARow = 0
    private var restartNotBeforeMs = 0L
    private var lastDeviceState: DeviceState? = null

    private val _nativeState = MutableStateFlow(mapNativeState(dat.snapshot.value))
    val nativeState: StateFlow<NativeState> = _nativeState.asStateFlow()

    init {
        watchPhoneNetwork()
        scope.launch { dat.snapshot.collect { onDatSnapshot(it) } }
        scope.launch { dat.faults.collect { onDatFault(it) } }
        scope.launch {
            dat.gyro.collect { sample ->
                headInput.onSample(sample, SystemClock.elapsedRealtime(), profile)?.let { send(it) }
            }
        }
        scope.launch {
            while (true) {
                delay(TICK_MS)
                announcer.onTick(SystemClock.elapsedRealtime())?.let(speech::sayLocal)
            }
        }
    }

    fun attachPage(send: (NativeToPage) -> Unit, activity: MainActivity) {
        page = send
        this.activity = activity
        if (datRunning) keepScreenOn(true)
    }

    /** A new activity can attach before the old one is destroyed. So only the attached activity detaches. */
    fun detachPage(activity: MainActivity) {
        if (this.activity !== activity) return
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
            is PageToNative.Intent -> send(DeviceToServer.Intent(message.kind, IntentSource.PHONE, message.promptId))
            is PageToNative.CartEdit -> send(DeviceToServer.CartEdit(message.productId, message.qty))
            is PageToNative.ProfileSet -> onProfilePatch(message.patch)
            is PageToNative.DataDelete -> deleteData()
            is PageToNative.SetupRegister,
            is PageToNative.SetupRequestCamera,
            is PageToNative.SetupOpenUpdate,
            is PageToNative.PocketSet,
            is PageToNative.Haptic -> log("page message with no handler yet: $message")
        }
    }

    /** The volume keys are no input yet. */
    @Suppress("UNUSED_PARAMETER")
    fun onVolumeKey(up: Boolean): Boolean = false

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
        if (socket != null) return
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
        socketOpen = false
        announcer.onSocketDown(SystemClock.elapsedRealtime())
        refreshNativeState()
    }

    private fun onServerMessage(message: ServerToDevice) {
        when (message) {
            is ServerToDevice.Speak -> {
                message.promptId?.let(prompts::onPromptSpoken)
                speech.onSpeak(message)
            }
            is ServerToDevice.Event -> {
                toPage(NativeToPage.Event(message.event))
                Codec.decodeServerEvent(message.event)?.let(prompts::onEvent)
            }
            is ServerToDevice.Snapshot -> {
                toPage(NativeToPage.Snapshot(message.session))
                profileOf(message.session)?.let { setProfile(it) }
            }
            // The cart stays on the server, and the socket stays open. The next start makes a new DAT session.
            is ServerToDevice.SessionRest -> stopDat()
            is ServerToDevice.SessionEnd -> onServerSessionEnd()
            is ServerToDevice.BiometricRequest -> log("biometric.request has no handler yet")
        }
    }

    private fun onServerSessionEnd() {
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
        setProfile(Profiles.applyPatch(profile, patch))
        send(DeviceToServer.ProfileSet(patch))
        if ("mainYes" in patch) {
            store.wantedMainYes = profile.mainYes
            // The shopper can select an input that does not work on these glasses.
            if (mainYesResolved) resolveMainYes()
        }
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
        waitingForGlasses = false
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
        sessionErrors.clear()
        streamErrors.clear()
        stopByApp = false
        stopCalled = false
        sawStreaming = false
        mainYesResolved = false
        headInput = newHeadInput()
        if (!dat.startSession(withCamera = true, autoAttach = true)) {
            // The SDK error of a failed start arrives through dat.faults, after this call returns.
            scope.launch { sendError(if (INSUFFICIENT_SDK in sessionErrors) NativeErrors.SDK_TOO_OLD else NativeErrors.SESSION_FAILED) }
            return
        }
        datRunning = true
        keepScreenOn(true)
        startPipeline()
    }

    /** Stops the DAT session because the app, the page, or the server asked for it. No error event follows. */
    private fun stopDat() {
        waitingForGlasses = false
        if (!datRunning) return
        stopByApp = true
        stopCalled = true
        dat.stopSession()
    }

    private fun startPipeline() {
        pipelineJob?.cancel()
        // The frame work runs on one background thread. dat.frames keeps only the newest frame, so nothing queues.
        pipelineJob = scope.launch(Dispatchers.Default.limitedParallelism(1)) {
            val pipeline = FramePipeline(
                gate = {
                    val link = socket
                    UploadGate.check(link?.isOpen == true, link?.queuedBytes() ?: 0, worn(dat.snapshot.value))
                },
                onKioskText = { text -> socket?.send(DeviceToServer.KioskSeen(text)) },
                onUpload = { header, jpeg -> socket?.sendFrame(header, jpeg) },
                log = ::log
            )
            try {
                dat.frames.collect { pipeline.onFrame(it) }
            } finally {
                pipeline.close()
            }
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
        log("main yes: ${store.wantedMainYes} does not work on these glasses, so it is $works")
        val patch = buildJsonObject { put("mainYes", GlanceJson.encodeToJsonElement(MainYes.serializer(), works)) }
        setProfile(Profiles.applyPatch(profile, patch))
        send(DeviceToServer.ProfileSet(patch))
    }

    private fun onDatFault(fault: DatFault) {
        when (fault.area) {
            DatFault.Area.SESSION -> sessionErrors.add(fault.name)
            DatFault.Area.STREAM -> streamErrors.add(fault.name)
            else -> Unit
        }
    }

    private fun onDatStopped(snapshot: DatSnapshot) {
        datRunning = false
        keepScreenOn(false)
        pipelineJob?.cancel()
        pipelineJob = null
        mainYesJob?.cancel()
        mainYesJob = null
        val facts = StopFacts(stopByApp, sessionErrors.toSet(), streamErrors.toSet(), snapshot.device?.link, snapshot.device?.hinge)
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

    private fun send(message: DeviceToServer) {
        if (socket?.send(message) != true) log("not sent, the socket is down: ${Codec.encode(message).take(MAX_LOGGED_CHARS)}")
    }

    private fun sendError(error: NativeError) {
        log("error ${error.code}")
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

    private fun keepScreenOn(on: Boolean) {
        val window = activity?.window ?: return
        if (on) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
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

    private fun newHeadInput() = HeadInput(
        HeadGestureDetector(HeadGestureConfig.of(store.sensitivity, ProbeDecisions.PITCH_AXIS, ProbeDecisions.PITCH_DOWN_SIGN, ProbeDecisions.YAW_AXIS)),
        prompts
    )

    // The server address is a setting, so each call reads it again.
    private fun api() = GlanceApi(client, store.serverUrl)

    private fun log(text: String) {
        Log.i(TAG, text)
    }

    private companion object {
        const val TAG = "Glance"
        const val PING_SECONDS = 10L
        const val TICK_MS = 1000L
        const val CLOSE_AFTER_END_MS = 5000L
        const val MAIN_YES_DELAY_MS = 5000L
        const val RESTART_DELAY_MS = 2000L
        const val MAX_RESTARTS_IN_A_ROW = 5
        const val MAX_LOGGED_CHARS = 120
        const val INSUFFICIENT_SDK = "INSUFFICIENT_SDK_VERSION"
    }
}
