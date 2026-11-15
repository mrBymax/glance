package com.metaglance.android

import android.app.Notification
import android.app.NotificationManager
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.metaglance.android.session.SessionService
import com.metaglance.android.support.FakeServerTestCase
import com.metaglance.android.support.waitFor
import com.metaglance.android.support.waitUntil
import com.metaglance.core.contract.IntentKind
import com.metaglance.core.contract.PageToNative
import com.metaglance.core.contract.ServerEvent
import com.metaglance.core.contract.StreamStatus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The foreground service of a session, which keeps the session alive with the screen off. The test reads the
 * service through its notification: Android shows it only while the service is in the foreground.
 *
 * The test runner grants the notification permission. The mock glasses use no Bluetooth, so the service runs
 * with the type `mediaPlayback` only.
 */
@RunWith(AndroidJUnit4::class)
class SessionServiceTest : FakeServerTestCase() {
    @Test
    fun theServiceRunsFromTheStartOfASessionToItsEnd() {
        assertFalse("A session is active before the start.", glance.session.sessionActive.value)
        startSession()
        val shown = awaitNotification()
        assertEquals("Shopping", shown.extras.getString(Notification.EXTRA_TITLE))
        assertTrue("The notification is not ongoing.", shown.flags and Notification.FLAG_ONGOING_EVENT != 0)

        page(PageToNative.SessionEnd)
        awaitNoNotification()
    }

    @Test
    fun theNotificationShowsTheItemCountAndTheTotalOfTheCart() {
        startSession()
        command("badclip")
        val pending = waitFor("the product prompt arrives", STEP_MS, ::state) { traffic.event<ServerEvent.GlancePending>() }
        page(PageToNative.Intent(IntentKind.YES, pending.promptId))
        // The cart of the fake server after an add: rye bread and oat drink, 4.49 EUR.
        waitUntil("the notification shows the cart", STEP_MS, { "text=${text()} ${state()}" }) { text() == "2 items, 4.49 EUR" }
    }

    @Test
    fun theActionOfTheNotificationStopsTheCameraAndTheService() {
        startSession()
        val action = awaitNotification().actions.single()
        assertEquals("Stop camera", action.title.toString())

        action.actionIntent.send()
        waitUntil("the stream stops", STEP_MS, ::state) { native.stream == StreamStatus.STOPPED }
        awaitNoNotification()
        // The server session stays, so the cart stays.
        assertTrue("The server session ended.", glance.profileStore.serverSession?.live == true)
    }

    @Test
    fun theServiceEndsWhenTheServerRestsTheSession() {
        startSession()
        awaitNotification()
        command("rest")
        waitUntil("the stream stops", STEP_MS, ::state) { native.stream == StreamStatus.STOPPED }
        awaitNoNotification()
    }

    private fun notification(): Notification? = targetContext.getSystemService(NotificationManager::class.java)
        .activeNotifications.firstOrNull { it.id == SessionService.NOTIFICATION_ID }?.notification

    private fun text(): String? = notification()?.extras?.getString(Notification.EXTRA_TEXT)

    private fun awaitNotification(): Notification = waitFor("the notification of the session shows", STEP_MS, ::state) { notification() }

    private fun awaitNoNotification() {
        waitUntil("the session is not active", STEP_MS, ::state) { !glance.session.sessionActive.value }
        waitUntil("the notification of the session is gone", STEP_MS, ::state) { notification() == null }
    }
}
