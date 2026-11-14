package com.metaglance.android

import android.app.Application
import android.os.VibrationEffect
import android.os.Vibrator
import android.util.Log
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
     * Plays one vibration. The argument holds the timings of `HapticPatterns`. The instrumented tests replace it,
     * because the test phone must stay quiet.
     */
    @Volatile
    var vibrate: (LongArray) -> Unit = { timings ->
        getSystemService(Vibrator::class.java)?.vibrate(VibrationEffect.createWaveform(timings, NO_REPEAT))
    }

    /** Confirms a payment above 50 EUR. The instrumented tests replace it, because nobody can touch the test phone. */
    @Volatile
    var paymentPrompt: PaymentPrompt = BiometricPaymentPrompt()

    val datLink: DatLink by lazy { DatLink(this, scope, { profileStore.streamSetup }) { datLog(it) } }
    val mockGlasses: MockGlassesController by lazy { MockGlassesController(this) }
    val profileStore: ProfileStore by lazy { ProfileStore(this) }

    /** The app holds one controller, so a new activity keeps the session. */
    val session: SessionController by lazy { SessionController(this, scope, datLink, profileStore) { vibrate(it) } }

    private companion object {
        const val NO_REPEAT = -1
    }
}
