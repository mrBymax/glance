package com.metaglance.android.session

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.metaglance.android.GlanceApp
import com.metaglance.android.MainActivity
import com.metaglance.android.R
import com.metaglance.core.state.SessionNotice
import kotlinx.coroutines.Job
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

/**
 * Keeps a session alive with the screen off and the phone locked. It holds three things: the right of the
 * process to run, a wake lock for the CPU, and the notification. The session objects stay in `GlanceApp`.
 *
 * The service runs while `SessionController.sessionActive` is true, and it stops itself after that. A request
 * to the service is a start command with an action, never `stopService`: a stop that comes before the first
 * `startForeground` makes Android end the app.
 * The pattern is that of `StreamingService` in the CameraAccess sample of the DAT SDK:
 * https://github.com/facebook/meta-wearables-dat-android
 */
class SessionService : Service() {
    private var wakeLock: PowerManager.WakeLock? = null
    private var watch: Job? = null
    private var lastStartId = 0
    private var foreground = false

    private val glance: GlanceApp get() = application as GlanceApp

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        lastStartId = startId
        val notice = glance.session.notice.value
        // A channel that exists gets the name again, in the language of this moment.
        val channel = NotificationChannel(CHANNEL_ID, notice.channel, NotificationManager.IMPORTANCE_LOW).apply { setShowBadge(false) }
        notifications.createNotificationChannel(channel)
        // After startForegroundService, Android ends the app if this call does not follow. So it comes first,
        // also for the action of the notification.
        try {
            ServiceCompat.startForeground(this, NOTIFICATION_ID, notification(notice), serviceTypes())
        } catch (e: IllegalStateException) {
            return giveUp(e)
        } catch (e: SecurityException) {
            return giveUp(e)
        }
        foreground = true
        if (intent?.action == ACTION_STOP_CAMERA) glance.session.stopCamera()
        if (watch == null) watch = glance.scope.launch { watchSession() }
        // The session can end before this command arrives. The watch does not see a value that it saw before.
        if (!glance.session.sessionActive.value) stop()
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        watch?.cancel()
        watch = null
        releaseWakeLock()
        super.onDestroy()
    }

    private suspend fun watchSession() {
        coroutineScope {
            launch {
                glance.session.notice.collect { notice -> if (foreground) notifications.notify(NOTIFICATION_ID, notification(notice)) }
            }
            glance.session.sessionActive.collectLatest { active ->
                if (!active) {
                    stop()
                    return@collectLatest
                }
                // The lock has a time limit, so a lock that the app lost does not stay forever. A long session gets a new one.
                while (true) {
                    holdWakeLock()
                    delay(WAKE_LOCK_RENEW_MS)
                }
            }
        }
    }

    private fun stop() {
        Log.i(TAG, "session service: stop")
        foreground = false
        releaseWakeLock()
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        // A start that is on its way keeps the service, and its command comes next.
        stopSelf(lastStartId)
    }

    private fun giveUp(cause: Exception): Int {
        Log.w(TAG, "session service: no foreground", cause)
        stopSelf()
        return START_NOT_STICKY
    }

    /**
     * `connectedDevice` needs the Bluetooth permission. Mock glasses run without it, and then the voice of the
     * app is the reason for the service.
     */
    private fun serviceTypes(): Int {
        val bluetooth = Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
        val connected = if (bluetooth) ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE else 0
        return ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK or connected
    }

    private val notifications: NotificationManager get() = getSystemService(NotificationManager::class.java)

    /** A tap opens the app. The one action stops the camera, and the cart stays on the server. */
    private fun notification(notice: SessionNotice): Notification {
        val flags = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        val open = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), flags)
        val stopCamera = PendingIntent.getService(this, 0, Intent(this, SessionService::class.java).setAction(ACTION_STOP_CAMERA), flags)
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_session)
            .setContentTitle(notice.title)
            .setContentText(notice.text)
            .setContentIntent(open)
            .addAction(0, notice.stopCamera, stopCamera)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun holdWakeLock() {
        val next = getSystemService(PowerManager::class.java).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, WAKE_LOCK_TAG)
        next.acquire(WAKE_LOCK_LIMIT_MS)
        releaseWakeLock()
        wakeLock = next
    }

    private fun releaseWakeLock() {
        wakeLock?.takeIf { it.isHeld }?.release()
        wakeLock = null
    }

    companion object {
        private const val TAG = "Glance"
        private const val CHANNEL_ID = "session"
        private const val ACTION_STOP_CAMERA = "com.metaglance.android.session.STOP_CAMERA"

        /** The instrumented tests find the notification with it. */
        const val NOTIFICATION_ID = 1
        private const val WAKE_LOCK_TAG = "Glance:session"
        private const val WAKE_LOCK_LIMIT_MS = 2 * 60 * 60 * 1000L
        private const val WAKE_LOCK_RENEW_MS = 60 * 60 * 1000L

        /**
         * Starts the service. Call it while the app is visible: Android refuses a foreground service that an app
         * in the background starts, and then the session runs only while the screen is on.
         */
        fun start(context: Context) {
            try {
                ContextCompat.startForegroundService(context, Intent(context, SessionService::class.java))
            } catch (e: IllegalStateException) {
                Log.w(TAG, "session service: Android refused the start", e)
            }
        }
    }
}
