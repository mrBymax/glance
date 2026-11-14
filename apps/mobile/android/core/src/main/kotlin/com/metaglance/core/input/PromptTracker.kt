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
 * A head gesture can answer each prompt while its line still plays, from [EARLY_OPEN_MS] after the line arrived.
 * The shopper never waits for the end of a line to nod or to shake. The server sends a product prompt and a pay
 * prompt, and this class makes no difference between them.
 *
 * Each function can run on each thread: the main thread gives the prompts, and the motion thread reads them.
 */
class PromptTracker {
    private var latestId: String? = null

    /** The time when the line of the latest prompt arrived. null when the caller gave no time: its window then opens at the end of the line. */
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
     * Rule R4: the prompt of the head window that `HeadInput` keeps. A prompt is here from the arrival of its line.
     * A line with interrupt starts to play when it arrives. A line that waits behind another line is here too,
     * so a nod during the line in front of it answers the prompt.
     */
    @Synchronized
    fun headPrompt(): HeadPrompt? {
        val id = latestId ?: return null
        if (latestEnded) return null
        val done = latestDoneMs
        val arrived = latestSpokenMs ?: latestStartMs ?: return done?.let { HeadPrompt(id, it, it) }
        val early = arrived + EARLY_OPEN_MS
        return HeadPrompt(id, if (done == null) early else min(early, done), done ?: ((latestStartMs ?: arrived) + MAX_LINE_MS))
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
         * The head window of each prompt opens this long after its line arrived. A person needs 200 ms or more to
         * react to a sound, so a gesture that starts earlier is no answer to the line: it is the movement that
         * lifts the product, or the turn to the kiosk. `HeadInput` drops a gesture that started before the window.
         */
        const val EARLY_OPEN_MS = 300L
        private const val MAX_LINE_MS = 20_000L
    }
}
