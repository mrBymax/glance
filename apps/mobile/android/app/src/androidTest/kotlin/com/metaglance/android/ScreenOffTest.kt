package com.metaglance.android

import androidx.lifecycle.Lifecycle
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.metaglance.android.support.ShopSessionTestCase
import com.metaglance.android.support.waitUntil
import com.metaglance.core.contract.IntentKind
import com.metaglance.core.contract.IntentSource
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * A session with no visible screen. The test stops the activity, as Android does when the screen turns off, and
 * the session must continue: frames go out, the prompt of a product arrives, and a nod adds the product.
 *
 * The test does not turn the screen of the phone off. So it shows that a session needs no activity and no page.
 * It does not show that Android keeps the process awake. The manual check with the power button shows that.
 */
@RunWith(AndroidJUnit4::class)
class ScreenOffTest : ShopSessionTestCase() {
    @Test
    fun aNodAddsAProductWhileTheActivityIsStopped() {
        startSession()
        scenarioRule.scenario.moveToState(Lifecycle.State.CREATED)
        assertTrue("The session ended with the activity.", glance.session.sessionActive.value)

        val framesBefore = traffic.frames.size
        waitUntil("frames go out with the activity stopped", STEP_MS, ::state) { traffic.frames.size >= framesBefore + 2 }

        val pending = awaitFinishedProductPrompt()
        waitUntil("Motion runs", STEP_MS, ::state) { native.capabilities.motion }
        playNod()
        awaitIntent(IntentKind.YES, IntentSource.HEAD, pending.promptId)
        awaitCartWith(pending.product.id)

        // The page gets the state again when the activity returns.
        scenarioRule.scenario.moveToState(Lifecycle.State.RESUMED)
        assertTrue("The session ended with the return of the activity.", glance.session.sessionActive.value)
    }
}
