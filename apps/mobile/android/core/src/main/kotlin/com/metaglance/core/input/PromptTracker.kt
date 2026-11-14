package com.metaglance.core.input

import com.metaglance.core.contract.ServerEvent

/**
 * Follows the prompts of the server, so that each answer of the shopper carries the right prompt ID.
 * A prompt is a spoken line with a prompt ID. It is finished when its line ended, and it is current until
 * the server ends it or a new prompt replaces it.
 */
class PromptTracker {
    private var latestId: String? = null

    /** The time when the line of the latest prompt ended. null while the line plays. */
    private var latestDoneMs: Long? = null
    private var latestEnded = false
    private var lastFinishedId: String? = null

    /** A line with this prompt ID arrived. It replaces an earlier prompt. A repeat of the latest prompt plays again. */
    fun onPromptSpoken(promptId: String) {
        latestId = promptId
        latestDoneMs = null
        latestEnded = false
    }

    /** `prompt.done` went out for this prompt. A report for a replaced prompt changes nothing. */
    fun onPromptDone(promptId: String, nowMs: Long) {
        if (promptId != latestId) return
        latestDoneMs = nowMs
        lastFinishedId = promptId
    }

    fun onEvent(event: ServerEvent) {
        val ends = when (event) {
            is ServerEvent.GlanceCleared -> event.promptId == latestId
            is ServerEvent.CheckoutCancelled, is ServerEvent.CheckoutPaid, is ServerEvent.CheckoutFailed -> true
            else -> false
        }
        if (ends) latestEnded = true
    }

    fun reset() {
        latestId = null
        latestDoneMs = null
        latestEnded = false
        lastFinishedId = null
    }

    /**
     * Rule R3: the ID that each yes and each no carries. It stays after the prompt ended,
     * because the server decides if the answer counts.
     */
    fun lastFinishedPromptId(): String? = lastFinishedId

    /** The prompt that is finished, and not ended or replaced. */
    fun currentPromptId(): String? = if (latestDoneMs != null && !latestEnded) latestId else null

    /**
     * Rule R4: the prompt that a head gesture answers now. It is the current prompt for `headWindowMs` after its
     * line ended. With no window, it is the current prompt until it ends.
     */
    fun headPromptId(nowMs: Long, headWindowMs: Long?): String? {
        val current = currentPromptId() ?: return null
        val doneMs = latestDoneMs ?: return null
        return if (headWindowMs == null || nowMs - doneMs < headWindowMs) current else null
    }
}
