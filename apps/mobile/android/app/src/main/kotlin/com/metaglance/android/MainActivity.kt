package com.metaglance.android

import android.Manifest
import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
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
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewAssetLoader
import com.metaglance.android.bridge.UiAssetsHandler
import com.metaglance.android.bridge.WebBridge
import java.io.IOException

/**
 * The one screen of the app: a WebView with the phone UI, or with the placeholder page.
 * `SessionController` handles each message of the page.
 */
class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var bridge: WebBridge
    private lateinit var pageUrl: String

    private val glance: GlanceApp get() = application as GlanceApp

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

    override fun onDestroy() {
        glance.session.detachPage(this)
        bridge.close()
        (webView.parent as? FrameLayout)?.removeView(webView)
        webView.destroy()
        super.onDestroy()
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        val handled = when (keyCode) {
            KeyEvent.KEYCODE_VOLUME_UP -> glance.session.onVolumeKey(up = true)
            KeyEvent.KEYCODE_VOLUME_DOWN -> glance.session.onVolumeKey(up = false)
            else -> false
        }
        return handled || super.onKeyDown(keyCode, event)
    }

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

            override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) = bridge.onPageStarted()
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
