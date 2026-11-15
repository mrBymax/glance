package com.metaglance.android

import android.Manifest
import android.app.Application
import android.content.pm.PackageManager
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.util.Log
import androidx.core.content.ContextCompat
import com.metaglance.android.dat.DatLink
import com.metaglance.android.mock.MockGlassesController
import com.metaglance.android.session.ProfileStore
import com.metaglance.android.session.SessionController
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

class GlanceApp : Application() {
    val scope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    /** Receives each log line of [datLink]. The probe replaces it with its own log. */
    @Volatile
    var datLog: (String) -> Unit = { Log.i("Glance", it) }

    /**
     * True makes "Glance" ask for the Bluetooth permission at its first resume. The instrumented tests set it to
     * false, because nobody can answer the prompt of Android there.
     */
    @Volatile
    var askBluetoothAtStart = true

    /** True after "Glance" asked for the Bluetooth permission at a resume. A new activity does not ask again. */
    var bluetoothAsked = false

    /**
     * Plays one vibration. The argument holds the timings of `HapticPatterns`, and `SessionController` selects
     * each one. The instrumented tests replace it, because the test phone must stay quiet.
     */
    @Volatile
    var vibrate: (LongArray) -> Unit = { timings ->
        getSystemService(Vibrator::class.java)?.vibrate(VibrationEffect.createWaveform(timings, NO_REPEAT))
    }

    /**
     * True when the phone lets the app show notifications. Before Android 13 no permission exists for it.
     * The instrumented tests replace it, because a test cannot take a permission away from its own process.
     */
    @Volatile
    var notificationsGranted: () -> Boolean = {
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
    }

    /**
     * Confirms a payment for a server that asks for a fingerprint. The instrumented tests replace it, because
     * nobody can touch the test phone.
     */
    @Volatile
    var paymentPrompt: PaymentPrompt = BiometricPaymentPrompt()

    val datLink: DatLink by lazy { DatLink(this, scope, { profileStore.streamSetup }) { datLog(it) } }
    val mockGlasses: MockGlassesController by lazy { MockGlassesController(this) }
    val profileStore: ProfileStore by lazy { ProfileStore(this) }

    /** The app holds one controller, so a new activity keeps the session. */
    val session: SessionController by lazy { SessionController(this, scope, datLink, profileStore, { vibrate(it) }) { notificationsGranted() } }

    private companion object {
        const val NO_REPEAT = -1
    }
}
