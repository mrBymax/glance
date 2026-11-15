package com.metaglance.android

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.metaglance.android.support.MockDeviceKitTestCase
import com.metaglance.android.support.TrafficRecorder
import com.metaglance.android.support.waitUntil
import com.metaglance.core.contract.CameraPermission
import com.metaglance.core.contract.Link
import com.metaglance.core.contract.NativeState
import com.metaglance.core.contract.NotificationPermission
import com.metaglance.core.contract.PageToNative
import com.metaglance.core.contract.Registration
import com.metaglance.core.state.NativeErrors
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The setup flow with mock glasses: rows 3 to 6 of Plan 2 Task 16 Step 2, and rows 2 to 4 of Task 17 Step 2.
 * Each test sends the setup messages of the page to the app and reads `NativeState`. No test needs a server.
 *
 * `setup.openUpdate` is not here. The SDK opens the Meta AI app for it, and no test uses that app.
 */
@RunWith(AndroidJUnit4::class)
class SetupFlowTest : MockDeviceKitTestCase<MainActivity>(MainActivity::class.java) {
    private val traffic = TrafficRecorder()

    private val native: NativeState get() = glance.session.nativeState.value

    @Before
    override fun setUp() {
        super.setUp()
        onMain { glance.session.tap = traffic }
    }

    @After
    override fun tearDown() {
        onMain { glance.session.tap = null }
        super.tearDown()
    }

    // A test cannot take a permission away from its own process, so it replaces the check of the app.
    @Test
    fun theNotificationPermissionIsUnknownBeforeTheRequestAndDeniedAfterIt() {
        val grantedBefore = glance.notificationsGranted
        val askedBefore = glance.profileStore.notificationsAsked
        try {
            onMain {
                glance.notificationsGranted = { false }
                glance.profileStore.notificationsAsked = false
                glance.session.refreshNotificationPermission()
            }
            assertEquals(NotificationPermission.UNKNOWN, native.notificationPermission)

            onMain {
                glance.profileStore.notificationsAsked = true
                glance.session.refreshNotificationPermission()
            }
            assertEquals(NotificationPermission.DENIED, native.notificationPermission)

            // The shopper allows the notifications in the settings of Android, and returns to the app.
            onMain { glance.notificationsGranted = { true } }
            scenarioRule.scenario.recreate()
            waitUntil("the notification permission is granted", STEP_MS, ::state) { native.notificationPermission == NotificationPermission.GRANTED }
        } finally {
            onMain {
                glance.notificationsGranted = grantedBefore
                glance.profileStore.notificationsAsked = askedBefore
                glance.session.refreshNotificationPermission()
            }
        }
    }

    @Test
    fun aRegistrationFromThePageGivesRegistered() {
        enableNotRegistered()
        assertNull("Mock glasses with no registration are visible to the app.", native.device)

        page(PageToNative.SetupRegister)
        waitUntil("the registration is registered", STEP_MS, ::state) { native.registration == Registration.REGISTERED }
        waitUntil("the device is connected", STEP_MS, ::state) { native.device?.link == Link.CONNECTED }
        assertTrue("Error events: ${traffic.nativeErrors}", traffic.nativeErrors.isEmpty())
    }

    @Test
    fun aRegistrationThatFailsGivesAnErrorEventAndStaysAvailable() {
        enableNotRegistered()
        onMain { glance.mockGlasses.setNextRegistration(works = false) }

        page(PageToNative.SetupRegister)
        waitUntil("the error event of a failed registration", STEP_MS, ::state) { NativeErrors.REGISTRATION_FAILED.code in traffic.nativeErrors }
        waitUntil("the registration is not registered", STEP_MS, ::state) { native.registration == Registration.UNAVAILABLE }
        assertTrue("The log has no registration error FAILED_TO_REGISTER: $datLog", datLog.any { it == "registration error FAILED_TO_REGISTER" })

        onMain { glance.mockGlasses.setNextRegistration(works = true) }
        page(PageToNative.SetupRegister)
        waitUntil("the registration is registered", STEP_MS, ::state) { native.registration == Registration.REGISTERED }
    }

    @Test
    fun aDeniedCameraRequestGivesDeniedAndAnAllowedOneGivesGranted() {
        pairGlasses()
        onMain { glance.mockGlasses.setCameraPermission(granted = false) }
        page(PageToNative.SetupRequestCamera)
        waitUntil("the camera permission is denied", STEP_MS, ::state) { native.cameraPermission == CameraPermission.DENIED }

        onMain { glance.mockGlasses.setCameraRequestResult(granted = true) }
        page(PageToNative.SetupRequestCamera)
        waitUntil("the camera permission is granted", STEP_MS, ::state) { native.cameraPermission == CameraPermission.GRANTED }
        assertEquals("Error events: ${traffic.nativeErrors}", emptyList<String>(), traffic.nativeErrors.toList())
    }

    @Test
    fun glassesThatConnectAfterTheStartGiveTheCameraPermission() {
        // The activity resumed with no glasses, and the SDK answers a permission check only with connected glasses.
        assertTrue("The state has a camera permission with no glasses: ${state()}", native.cameraPermission != CameraPermission.GRANTED)
        pairGlasses()
        waitUntil("the camera permission is granted", STEP_MS, ::state) { native.cameraPermission == CameraPermission.GRANTED }
    }

    @Test
    fun aResumeReadsTheCameraPermissionAgain() {
        pairGlasses()
        onMain { glance.mockGlasses.setCameraPermission(granted = false) }
        // The shopper returns from Meta AI: the activity resumes, and it reads the permissions of the SDK.
        scenarioRule.scenario.recreate()
        waitUntil("the camera permission is denied", STEP_MS, ::state) { native.cameraPermission == CameraPermission.DENIED }

        onMain { glance.mockGlasses.setCameraPermission(granted = true) }
        scenarioRule.scenario.recreate()
        waitUntil("the camera permission is granted", STEP_MS, ::state) { native.cameraPermission == CameraPermission.GRANTED }
    }

    /**
     * Starts MockDeviceKit again with no registration, and pairs mock glasses.
     *
     * Plan 2 expects the registration state `available` here. MockDeviceKit of DAT 1.0.1 reports `UNAVAILABLE`
     * until the registration, as the reference of `MockDeviceKitConfig.initiallyRegistered` says:
     * https://wearables.developer.meta.com/docs/reference/android/dat/1.0/com_meta_wearable_dat_mockdevice_api_mockdevicekitconfig
     */
    private fun enableNotRegistered() {
        onMain {
            glance.mockGlasses.enable(registered = false)
            glance.datLink.initialize(bluetoothGranted = false)
            assertTrue("The pairing failed.", glance.mockGlasses.pair())
        }
        waitUntil("the registration is unavailable", STEP_MS, ::state) { native.registration == Registration.UNAVAILABLE }
    }

    private fun page(message: PageToNative) = onMain { glance.session.onPageMessage(message) }

    private fun state(): String = "native=$native errors=${traffic.nativeErrors} dat=${datLog.takeLast(LOG_TAIL)}"

    private companion object {
        const val STEP_MS = 10_000L
        const val LOG_TAIL = 12
    }
}
