package com.metaglance.core.input

import com.metaglance.core.contract.ServerEvent
import kotlin.math.min

/**
 * The prompt that a head gesture can answer. A gesture counts from `openMs`.
 * `doneMs` is the time at which its line ended. While the line plays, it is the latest time at which the line can end.
 */
class HeadPrompt(val promptId: String, val openMs: Long, val doneMs: Long)

/**
 * Follows the prompts of the server, so that each answer of the shopper carries the right prompt ID.
 * A prompt is a spoken line with a prompt ID. It is finished when its line ended, and it is current until
 * the server ends it or a new prompt replaces it.
 *
 * A head gesture can answer a product prompt while its line still plays, from [EARLY_OPEN_MS] after the start of
 * the line. A pay prompt takes a head gesture only after its line: a movement during the line must not pay.
 *
 * Each function can run on each thread: the main thread gives the prompts, and the motion thread reads them.
 */
class PromptTracker {
    private var latestId: String? = null

    /** The ID of the last product prompt: the event `glance.pending` names it. */
    private var productId: String? = null

    /** The time when the line of the latest prompt arrived. null when the caller gave no time. */
    private var latestSpokenMs: Long? = null

    /** The time when the line of the latest prompt started to play. null while it waits, and for a line with no sound. */
    private var latestStartMs: Long? = null

    /** The time when the line of the latest prompt ended. null while the line plays. */
    private var latestDoneMs: Long? = null
    private var latestEnded = false
    private var lastFinishedId: String? = null

    /** A line with this prompt ID arrived. It replaces an earlier prompt. A repeat of the latest prompt plays again. */
    @Synchronized
    fun onPromptSpoken(promptId: String, nowMs: Long? = null) {
        latestId = promptId
        latestSpokenMs = nowMs
        latestStartMs = null
        latestDoneMs = null
        latestEnded = false
    }

    /** The line of this prompt started to play. A report for a replaced prompt changes nothing. */
    @Synchronized
    fun onLineStart(promptId: String, nowMs: Long) {
        if (promptId == latestId) latestStartMs = nowMs
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
        if (event is ServerEvent.GlancePending) productId = event.promptId
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
        productId = null
        latestSpokenMs = null
        latestStartMs = null
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

    /**
     * Rule R4: the prompt of the head window that `HeadInput` keeps. A product prompt is here from the start of
     * its line, and each other prompt when it is finished.
     */
    @Synchronized
    fun headPrompt(): HeadPrompt? {
        val id = latestId ?: return null
        if (latestEnded) return null
        val done = latestDoneMs
        val start = latestStartMs
        if (id == productId && start != null) {
            val early = start + EARLY_OPEN_MS
            return HeadPrompt(id, if (done == null) early else min(early, done), done ?: (start + MAX_LINE_MS))
        }
        return done?.let { HeadPrompt(id, it, it) }
    }

    /** The time when the line of this prompt started to play, for the log. null for a replaced prompt and for a line that did not start. */
    @Synchronized
    fun lineStartMs(promptId: String): Long? = if (promptId == latestId) latestStartMs else null

    /**
     * True from the start of the line of a prompt to its end. A line that an interrupt removed never reports
     * its end, so a line plays for [MAX_LINE_MS] at most.
     */
    @Synchronized
    fun linePlaying(nowMs: Long): Boolean {
        if (latestId == null || latestDoneMs != null || latestEnded) return false
        return latestSpokenMs?.let { nowMs - it < MAX_LINE_MS } ?: true
    }

    companion object {
        /**
         * The head window of a product prompt opens this long after the start of its line. A shopper who nods at
         * the name of the product is later than this, and the movement of the head that lifts the product is over.
         */
        const val EARLY_OPEN_MS = 1200L
        private const val MAX_LINE_MS = 20_000L
    }
}
