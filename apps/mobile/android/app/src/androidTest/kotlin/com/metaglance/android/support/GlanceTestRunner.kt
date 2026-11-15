package com.metaglance.android.support

import android.Manifest
import android.app.Application
import android.os.Build
import androidx.test.runner.AndroidJUnitRunner
import com.metaglance.android.GlanceApp
import java.util.concurrent.CopyOnWriteArrayList

/**
 * The runner of the instrumented tests. It changes three parts of the app before the first test starts,
 * because nobody is at the test phone:
 *
 * - "Glance" does not ask for the Bluetooth permission at its start. A prompt of Android with no answer stays
 *   on the screen and pauses the activity.
 * - No vibration plays. `vibrations` keeps the timings of each one for the tests.
 * - The app has the notification permission. Without it the page shows the notification step of the setup,
 *   and the notification of a session does not show.
 */
class GlanceTestRunner : AndroidJUnitRunner() {
    override fun callApplicationOnCreate(app: Application) {
        (app as GlanceApp).apply {
            askBluetoothAtStart = false
            vibrate = { timings -> vibrations.add(timings.toList()) }
        }
        super.callApplicationOnCreate(app)
    }

    override fun onStart() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            uiAutomation.grantRuntimePermission(targetContext.packageName, Manifest.permission.POST_NOTIFICATIONS)
        }
        super.onStart()
    }

    companion object {
        /** The timings of each vibration that the app asked for, in order. */
        val vibrations = CopyOnWriteArrayList<List<Long>>()
    }
}
