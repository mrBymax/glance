package com.metaglance.android

import android.content.Context
import android.util.Log
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_WEAK
import androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.metaglance.core.input.PromptOutcome

/**
 * The prompt that confirms a payment above 50 EUR. `GlanceApp` holds one. The instrumented tests replace it,
 * because nobody can put a finger on the test phone.
 */
interface PaymentPrompt {
    /** False for a phone with no screen lock and no biometric. */
    fun available(context: Context): Boolean

    /**
     * Shows the prompt. `onOutcome` runs on the main thread: any number of `ATTEMPT_FAILED`, then one `SUCCEEDED`
     * or one `ERROR`.
     */
    fun show(activity: FragmentActivity, onOutcome: (PromptOutcome) -> Unit)

    /** Closes an open prompt. Its `onOutcome` then gets `ERROR`. */
    fun cancel()
}

/**
 * The biometric prompt of Android. The shopper confirms with a fingerprint or a face, or with the screen lock of
 * the phone. This pair of authenticators works from Android 10. The screen lock takes the place of the negative
 * button, so the prompt has no text for one.
 */
class BiometricPaymentPrompt : PaymentPrompt {
    private var prompt: BiometricPrompt? = null

    override fun available(context: Context): Boolean = BiometricManager.from(context).canAuthenticate(AUTHENTICATORS) == BiometricManager.BIOMETRIC_SUCCESS

    override fun show(activity: FragmentActivity, onOutcome: (PromptOutcome) -> Unit) {
        val callback = object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                prompt = null
                onOutcome(PromptOutcome.SUCCEEDED)
            }

            // A cancel is an error too: the back key, a tap outside the prompt, and `cancel`.
            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                Log.i(TAG, "payment prompt error $errorCode")
                prompt = null
                onOutcome(PromptOutcome.ERROR)
            }

            override fun onAuthenticationFailed() = onOutcome(PromptOutcome.ATTEMPT_FAILED)
        }
        val info = BiometricPrompt.PromptInfo.Builder()
            .setTitle(TITLE)
            .setSubtitle(SUBTITLE)
            .setAllowedAuthenticators(AUTHENTICATORS)
            .build()
        prompt = BiometricPrompt(activity, ContextCompat.getMainExecutor(activity), callback).also { it.authenticate(info) }
    }

    override fun cancel() {
        prompt?.cancelAuthentication()
    }

    companion object {
        const val TITLE = "Confirm payment"
        const val SUBTITLE = "Demo payment. No money moves."
        private const val TAG = "Glance"
        private const val AUTHENTICATORS = BIOMETRIC_WEAK or DEVICE_CREDENTIAL
    }
}
