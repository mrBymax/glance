package com.metaglance.android

import android.Manifest
import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.webkit.WebViewAssetLoader
import com.meta.wearable.dat.core.Wearables
import com.meta.wearable.dat.core.types.Permission
import com.meta.wearable.dat.core.types.PermissionError
import com.metaglance.android.bridge.UiAssetsHandler
import com.metaglance.android.bridge.WebBridge
import com.metaglance.core.input.PromptOutcome
import com.metaglance.core.state.NativeErrors
import java.io.IOException
import kotlinx.coroutines.launch

/**
 * The one screen of the app: a WebView with the phone UI, or with the placeholder page.
 * `SessionController` handles each message of the page.
 */
class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var bridge: WebBridge
    private lateinit var pageUrl: String

    private val glance: GlanceApp get() = application as GlanceApp

    /** The volume keys whose key down was an answer to a prompt. Android does not get their repeat events and their key up. */
    private val answerKeys = HashSet<Int>()

    private var afterBluetooth: (Boolean) -> Unit = {}
    private val bluetoothRequest = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        onBluetoothAnswer(granted)
    }
    private val cameraRequest = registerForActivityResult(Wearables.RequestPermissionContract()) { result ->
        glance.datLink.onPermissionResult(Permission.CAMERA, result)
        result.onFailure { error, _ ->
            // A missing Meta AI app is in `metaAiInstalled` of the state, and the page has a screen for it.
            if (error != PermissionError.META_AI_NOT_INSTALLED) glance.session.reportError(NativeErrors.PERMISSION_FAILED)
        }
    }

    private var microphoneAsked = false
    private val microphoneRequest = registerForActivityResult(Wearables.RequestPermissionContract()) { result ->
        microphoneAsked = false
        // The bridge has no message for this permission. A denied request leaves Speech off, and the main yes
        // falls back to another input.
        glance.datLink.onPermissionResult(Permission.MICROPHONE, result)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        volumeControlStream = AudioManager.STREAM_MUSIC
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        buildWebView()
        bridge = WebBridge(webView, glance.session::onPageMessage)

        // After a registration, Meta AI opens this activity again. The SDK must run before it gets the intent.
        if (glance.mockGlasses.enabled || bluetoothGranted()) glance.datLink.initialize(bluetoothGranted())
        glance.datLink.handleIntent(this, intent)

        glance.session.attachPage(bridge::send, this)
        pageUrl = if (BuildConfig.DEBUG && BuildConfig.UI_DEV_URL.isNotEmpty()) {
            BuildConfig.UI_DEV_URL
        } else {
            PAGE_URL + if (BuildConfig.DEBUG) "?debug=1" else ""
        }
        webView.loadUrl(pageUrl)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        glance.datLink.handleIntent(this, intent)
    }

    override fun onResume() {
        super.onResume()
        val dat = glance.datLink
        // The first resume asks for Bluetooth, because the SDK does not start without it. Mock glasses need none.
        if (!glance.bluetoothAsked && !dat.ready && !glance.mockGlasses.enabled) {
            glance.bluetoothAsked = true
            if (glance.askBluetoothAtStart) requestBluetooth {}
        }
        // The shopper returns from Meta AI through this path, and a permission can be new.
        if (dat.ready) lifecycleScope.launch { dat.refreshPermissions() }
    }

    /**
     * Asks for the Bluetooth permission of Android, starts the SDK with the answer, and then calls `then`.
     * Android shows its prompt two times at most. After that, the answer is "denied" with no prompt.
     */
    fun requestBluetooth(then: (Boolean) -> Unit) {
        afterBluetooth = then
        if (bluetoothGranted()) onBluetoothAnswer(true) else bluetoothRequest.launch(Manifest.permission.BLUETOOTH_CONNECT)
    }

    /** Asks for the camera permission of the glasses. The SDK shows the request in the Meta AI app. */
    fun requestCameraPermission() = cameraRequest.launch(Permission.CAMERA)

    /**
     * Asks for the microphone permission of the glasses, which Speech needs. The SDK shows the request in the
     * Meta AI app. A request that still waits for its answer is not sent again.
     */
    fun requestMicrophonePermission() {
        if (microphoneAsked) return
        microphoneAsked = true
        microphoneRequest.launch(Permission.MICROPHONE)
    }

    /** False for a phone with no screen lock and no biometric. Such a phone cannot confirm a payment. */
    fun paymentAvailable(): Boolean = glance.paymentPrompt.available(this)

    /**
     * Shows the prompt that confirms a payment, for a server that asks for it. `onOutcome` gets each outcome of
     * the prompt.
     */
    fun confirmPayment(onOutcome: (PromptOutcome) -> Unit) {
        // The biometric library shows no prompt after onSaveInstanceState, and it reports nothing then.
        if (supportFragmentManager.isStateSaved) {
            Log.w(TAG, "payment prompt: the activity is in the background")
            onOutcome(PromptOutcome.ERROR)
            return
        }
        glance.paymentPrompt.show(this, onOutcome)
    }

    fun cancelPayment() = glance.paymentPrompt.cancel()

    private fun onBluetoothAnswer(granted: Boolean) {
        glance.datLink.initialize(granted)
        // Meta AI can have opened this activity before the SDK ran.
        if (granted) glance.datLink.handleIntent(this, intent)
        val then = afterBluetooth
        afterBluetooth = {}
        then(granted)
    }

    override fun onDestroy() {
        glance.session.detachPage(this)
        bridge.close()
        (webView.parent as? FrameLayout)?.removeView(webView)
        webView.destroy()
        super.onDestroy()
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        if (keyCode != KeyEvent.KEYCODE_VOLUME_UP && keyCode != KeyEvent.KEYCODE_VOLUME_DOWN) return super.onKeyDown(keyCode, event)
        // A key that stays down sends repeat events. They are part of the first press, so they send no new answer.
        if (event.repeatCount > 0) return keyCode in answerKeys || super.onKeyDown(keyCode, event)
        if (glance.session.onVolumeKey(up = keyCode == KeyEvent.KEYCODE_VOLUME_UP)) {
            answerKeys.add(keyCode)
            return true
        }
        answerKeys.remove(keyCode)
        return super.onKeyDown(keyCode, event)
    }

    override fun onKeyUp(keyCode: Int, event: KeyEvent): Boolean = answerKeys.remove(keyCode) || super.onKeyUp(keyCode, event)

    // The page needs JavaScript. It comes from the APK, or from the dev server of a debug build.
    @SuppressLint("SetJavaScriptEnabled")
    private fun buildWebView() {
        val root = uiRoot()
        Log.i(TAG, "page root: $root")
        val loader = WebViewAssetLoader.Builder().addPathHandler("/", UiAssetsHandler(assets, root)).build()
        webView = WebView(this)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            // The page follows the font size of the phone.
            textZoom = (resources.configuration.fontScale * 100).toInt()
        }
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? = loader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (isPageAddress(request.url)) return false
                openOutside(request.url)
                return true
            }
        }
        val frame = FrameLayout(this).apply { fitsSystemWindows = true }
        frame.addView(webView, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
        setContentView(frame)
    }

    /** `ui` holds the build of the phone UI. An APK that was built without it shows the placeholder page. */
    private fun uiRoot(): String {
        if (glance.profileStore.usePlaceholder) return PLACEHOLDER_ROOT
        return try {
            assets.open("$UI_ROOT/index.html").close()
            UI_ROOT
        } catch (_: IOException) {
            PLACEHOLDER_ROOT
        }
    }

    private fun isPageAddress(url: Uri): Boolean {
        val page = Uri.parse(pageUrl)
        return url.scheme == page.scheme && url.host == page.host && url.port == page.port
    }

    // A link to another site opens in the app for it, for example the store page of Meta AI.
    private fun openOutside(url: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, url))
        } catch (_: ActivityNotFoundException) {
            Log.w(TAG, "no app opens $url")
        }
    }

    private fun bluetoothGranted(): Boolean = Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
        ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED

    private companion object {
        const val TAG = "Glance"
        const val PAGE_URL = "https://appassets.androidplatform.net/index.html"
        const val UI_ROOT = "ui"
        const val PLACEHOLDER_ROOT = "placeholder"
    }
}
