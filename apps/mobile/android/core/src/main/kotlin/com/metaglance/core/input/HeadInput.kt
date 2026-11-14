package com.metaglance.core.input

import com.metaglance.core.contract.DeviceToServer
import com.metaglance.core.contract.IntentKind
import com.metaglance.core.contract.IntentSource
import com.metaglance.core.contract.Profile
import com.metaglance.core.contract.YesGesture
import com.metaglance.core.gesture.GyroSample
import com.metaglance.core.gesture.HeadGesture
import com.metaglance.core.gesture.HeadGestureDetector

/** Turns a nod or a shake into a yes or a no, while a prompt has its head window open. */
class HeadInput(private val detector: HeadGestureDetector, private val prompts: PromptTracker) {
    /** The prompt whose head window the detector follows. */
    private var followedPromptId: String? = null

    fun onSample(sample: GyroSample, nowMs: Long, profile: Profile): DeviceToServer.Intent? {
        val promptId = if (profile.headGestures) prompts.headPromptId(nowMs, profile.headWindowMs) else null
        // The detector starts from rest for each head window, so a movement that started before the window,
        // or in the window of another prompt, is no answer.
        if (promptId != followedPromptId) {
            detector.reset()
            followedPromptId = promptId
        }
        if (promptId == null) return null
        val gesture = detector.onSample(sample) ?: return null
        val yesGesture = if (profile.yesGesture == YesGesture.NOD) HeadGesture.NOD else HeadGesture.SHAKE
        val kind = if (gesture == yesGesture) IntentKind.YES else IntentKind.NO
        return DeviceToServer.Intent(kind, IntentSource.HEAD, promptId)
    }
}
