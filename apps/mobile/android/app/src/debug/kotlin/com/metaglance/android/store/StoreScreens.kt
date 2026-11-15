package com.metaglance.android.store

import android.app.Activity
import android.graphics.Typeface
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import com.metaglance.android.GlanceApp
import com.metaglance.core.net.StoreApi
import java.util.concurrent.TimeUnit
import okhttp3.OkHttpClient

/** What the two store screens of the debug build share: the calls to the server, and the sizes of their views. */
internal object StoreScreens {
    const val PAD_DP = 16
    const val GAP_DP = 12
    const val BUTTON_HEIGHT_DP = 56
    const val TITLE_SP = 22f
    const val TEXT_SP = 18f
    const val SMALL_SP = 14f

    private const val CONNECT_SECONDS = 4L
    private const val READ_SECONDS = 15L

    /** A picture of 1600 pixels has about 400 kB, and a phone on a weak network needs time for it. */
    private const val WRITE_SECONDS = 30L

    private val client: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(CONNECT_SECONDS, TimeUnit.SECONDS)
            .readTimeout(READ_SECONDS, TimeUnit.SECONDS)
            .writeTimeout(WRITE_SECONDS, TimeUnit.SECONDS)
            .build()
    }

    /** The calls go to the server address of the app: the field `Server URL` of the mock menu, else the address of the build. */
    fun api(activity: Activity): StoreApi = StoreApi(client, (activity.application as GlanceApp).profileStore.serverUrl)

    fun dp(activity: Activity, value: Int): Int = (value * activity.resources.displayMetrics.density).toInt()

    fun text(activity: Activity, sizeSp: Float, bold: Boolean = false): TextView {
        val view = TextView(activity)
        view.textSize = sizeSp
        if (bold) view.setTypeface(view.typeface, Typeface.BOLD)
        return view
    }

    /** A button over the whole width, high enough for a thumb. */
    fun button(activity: Activity, label: String, onClick: () -> Unit): Button {
        val button = Button(activity)
        button.text = label
        button.isAllCaps = false
        button.textSize = TEXT_SP
        button.minHeight = dp(activity, BUTTON_HEIGHT_DP)
        button.setOnClickListener { onClick() }
        return button
    }

    /** The whole width, with a gap above. */
    fun wide(activity: Activity, topDp: Int = 0): LinearLayout.LayoutParams {
        val params = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT)
        params.topMargin = dp(activity, topDp)
        return params
    }
}
