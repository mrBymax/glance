package com.metaglance.android.support

import android.app.Application
import androidx.test.runner.AndroidJUnitRunner
import com.metaglance.android.GlanceApp
import java.util.concurrent.CopyOnWriteArrayList

/**
 * The runner of the instrumented tests. It changes two parts of the app before the first activity starts,
 * because nobody is at the test phone:
 *
 * - "Glance" does not ask for the Bluetooth permission at its start. A prompt of Android with no answer stays
 *   on the screen and pauses the activity.
 * - No vibration plays. `vibrations` keeps the timings of each one for the tests.
 */
class GlanceTestRunner : AndroidJUnitRunner() {
    override fun callApplicationOnCreate(app: Application) {
        (app as GlanceApp).apply {
            askBluetoothAtStart = false
            vibrate = { timings -> vibrations.add(timings.toList()) }
        }
        super.callApplicationOnCreate(app)
    }

    companion object {
        /** The timings of each vibration that the app asked for, in order. */
        val vibrations = CopyOnWriteArrayList<List<Long>>()
    }
}
