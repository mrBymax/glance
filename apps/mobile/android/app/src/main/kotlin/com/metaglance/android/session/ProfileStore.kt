package com.metaglance.android.session

import android.content.Context
import android.content.SharedPreferences
import com.metaglance.android.BuildConfig
import com.metaglance.core.barcode.LabelTiming
import com.metaglance.core.contract.GlanceJson
import com.metaglance.core.contract.MainYes
import com.metaglance.core.contract.Profile
import com.metaglance.core.contract.Profiles
import com.metaglance.core.gesture.Sensitivity
import kotlinx.serialization.SerializationException

/** The session of the server that the app last created. `live` is false after the server ended it. */
class StoredSession(val sessionId: String, val token: String, val wsUrl: String, val live: Boolean)

/** The values that the app keeps over a restart, in the preferences file `glance`. */
class ProfileStore(context: Context) {
    private val prefs: SharedPreferences = context.applicationContext.getSharedPreferences("glance", Context.MODE_PRIVATE)

    /** A stored profile that this app version cannot read, or that the server does not accept, gives the default profile. */
    var profile: Profile
        get() {
            val text = prefs.getString(KEY_PROFILE, null) ?: return Profiles.DEFAULT
            val stored = try {
                GlanceJson.decodeFromString(Profile.serializer(), text)
            } catch (_: SerializationException) {
                return Profiles.DEFAULT
            } catch (_: IllegalArgumentException) {
                return Profiles.DEFAULT
            }
            return if (Profiles.isValid(stored)) stored else Profiles.DEFAULT
        }
        set(value) = prefs.edit().putString(KEY_PROFILE, GlanceJson.encodeToString(Profile.serializer(), value)).apply()

    /** The yes input that the shopper selected. `profile.mainYes` can differ: it is the input that works on these glasses. */
    var wantedMainYes: MainYes
        get() = enumOf(prefs.getString(KEY_WANTED_MAIN_YES, null), MainYes.HEAD)
        set(value) = prefs.edit().putString(KEY_WANTED_MAIN_YES, value.name).apply()

    var serverSession: StoredSession?
        get() {
            val sessionId = prefs.getString(KEY_SESSION_ID, null) ?: return null
            val token = prefs.getString(KEY_SESSION_TOKEN, null) ?: return null
            val wsUrl = prefs.getString(KEY_SESSION_WS_URL, null) ?: return null
            return StoredSession(sessionId, token, wsUrl, prefs.getBoolean(KEY_SESSION_LIVE, false))
        }
        set(value) {
            val edit = prefs.edit()
            if (value == null) {
                SESSION_KEYS.forEach { edit.remove(it) }
            } else {
                edit.putString(KEY_SESSION_ID, value.sessionId)
                    .putString(KEY_SESSION_TOKEN, value.token)
                    .putString(KEY_SESSION_WS_URL, value.wsUrl)
                    .putBoolean(KEY_SESSION_LIVE, value.live)
            }
            edit.apply()
        }

    var serverUrl: String
        get() = prefs.getString(KEY_SERVER_URL, null)?.takeIf { it.isNotBlank() } ?: BuildConfig.SERVER_URL
        set(value) = prefs.edit().putString(KEY_SERVER_URL, value.trim()).apply()

    var sensitivity: Sensitivity
        get() = enumOf(prefs.getString(KEY_SENSITIVITY, null), Sensitivity.NORMAL)
        set(value) = prefs.edit().putString(KEY_SENSITIVITY, value.name).apply()

    /** The wait before a label still that the mock menu set, or null for the value of the build. */
    var labelWaitMs: Long?
        get() = longOrNull(KEY_LABEL_WAIT_MS)
        set(value) = putLongOrRemove(KEY_LABEL_WAIT_MS, value)

    /** The gap between two label stills that the mock menu set, or null for the value of the build. */
    var labelGapMs: Long?
        get() = longOrNull(KEY_LABEL_GAP_MS)
        set(value) = putLongOrRemove(KEY_LABEL_GAP_MS, value)

    /** The two times of the label still for the next camera start. */
    val labelTiming: LabelTiming
        get() = LabelTiming.within(labelWaitMs ?: BuildConfig.LABEL_WAIT_MS, labelGapMs ?: BuildConfig.LABEL_GAP_MS)

    /** True makes the app show its placeholder page in place of the phone UI. */
    var usePlaceholder: Boolean
        get() = prefs.getBoolean(KEY_USE_PLACEHOLDER, false)
        set(value) = prefs.edit().putBoolean(KEY_USE_PLACEHOLDER, value).apply()

    /** Sets `profile`, `wantedMainYes`, and `serverSession` back to their defaults. The settings of the app stay. */
    fun clear() {
        val edit = prefs.edit().remove(KEY_PROFILE).remove(KEY_WANTED_MAIN_YES)
        SESSION_KEYS.forEach { edit.remove(it) }
        edit.apply()
    }

    private fun longOrNull(key: String): Long? = if (prefs.contains(key)) prefs.getLong(key, 0) else null

    private fun putLongOrRemove(key: String, value: Long?) {
        val edit = prefs.edit()
        if (value == null) edit.remove(key) else edit.putLong(key, value)
        edit.apply()
    }

    private inline fun <reified T : Enum<T>> enumOf(name: String?, default: T): T = enumValues<T>().firstOrNull { it.name == name } ?: default

    private companion object {
        const val KEY_PROFILE = "profile"
        const val KEY_WANTED_MAIN_YES = "wantedMainYes"
        const val KEY_SESSION_ID = "session.id"
        const val KEY_SESSION_TOKEN = "session.token"
        const val KEY_SESSION_WS_URL = "session.wsUrl"
        const val KEY_SESSION_LIVE = "session.live"
        const val KEY_SERVER_URL = "serverUrl"
        const val KEY_SENSITIVITY = "sensitivity"
        const val KEY_USE_PLACEHOLDER = "usePlaceholder"
        const val KEY_LABEL_WAIT_MS = "labelWaitMs"
        const val KEY_LABEL_GAP_MS = "labelGapMs"
        val SESSION_KEYS = listOf(KEY_SESSION_ID, KEY_SESSION_TOKEN, KEY_SESSION_WS_URL, KEY_SESSION_LIVE)
    }
}
