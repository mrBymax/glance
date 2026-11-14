package com.metaglance.core.input

import com.metaglance.core.contract.ServerEvent

/** The prompt that a head gesture can answer, with the time at which its line ended. */
class HeadPrompt(val promptId: String, val doneMs: Long)

/**
 * Follows the prompts of the server, so that each answer of the shopper carries the right prompt ID.
 * A prompt is a spoken line with a prompt ID. It is finished when its line ended, and it is current until
 * the server ends it or a new prompt replaces it.
 *
 * Each function can run on each thread: the main thread gives the prompts, and the motion thread reads them.
 */
class PromptTracker {
    private var latestId: String? = null

    /** The time when the line of the latest prompt arrived. null when the caller gave no time. */
    private var latestSpokenMs: Long? = null

    /** The time when the line of the latest prompt ended. null while the line plays. */
    private var latestDoneMs: Long? = null
    private var latestEnded = false
    private var lastFinishedId: String? = null

    /** A line with this prompt ID arrived. It replaces an earlier prompt. A repeat of the latest prompt plays again. */
    @Synchronized
    fun onPromptSpoken(promptId: String, nowMs: Long? = null) {
        latestId = promptId
        latestSpokenMs = nowMs
        latestDoneMs = null
        latestEnded = false
    }

    /** `prompt.done` went out for this prompt. A report for a replaced prompt changes nothing. */
    @Synchronized
    fun onPromptDone(promptId: String, nowMs: Long) {
        if (promptId != latestId) return
        latestDoneMs = nowMs
        lastFinishedId = promptId
    }

    @Synchronized
    fun onEvent(event: ServerEvent) {
        val ends = when (event) {
            is ServerEvent.GlanceCleared -> event.promptId == latestId
            is ServerEvent.CheckoutCancelled, is ServerEvent.CheckoutPaid, is ServerEvent.CheckoutFailed -> true
            else -> false
        }
        if (ends) latestEnded = true
    }

    @Synchronized
    fun reset() {
        latestId = null
        latestSpokenMs = null
        latestDoneMs = null
        latestEnded = false
        lastFinishedId = null
    }

    /**
     * Rule R3: the ID that each yes and each no carries. It stays after the prompt ended,
     * because the server decides if the answer counts.
     */
    @Synchronized
    fun lastFinishedPromptId(): String? = lastFinishedId

    /** The prompt that is finished, and not ended or replaced. */
    @Synchronized
    fun currentPromptId(): String? = if (latestDoneMs != null && !latestEnded) latestId else null

    /** Rule R4: the current prompt, for the head window that `HeadInput` keeps. */
    @Synchronized
    fun headPrompt(): HeadPrompt? {
        val id = currentPromptId() ?: return null
        return latestDoneMs?.let { HeadPrompt(id, it) }
    }

    /**
     * True from the start of the line of a prompt to its end. A line that an interrupt removed never reports
     * its end, so a line plays for [MAX_LINE_MS] at most.
     */
    @Synchronized
    fun linePlaying(nowMs: Long): Boolean {
        if (latestId == null || latestDoneMs != null || latestEnded) return false
        return latestSpokenMs?.let { nowMs - it < MAX_LINE_MS } ?: true
    }

    private companion object {
        const val MAX_LINE_MS = 20_000L
    }
}
