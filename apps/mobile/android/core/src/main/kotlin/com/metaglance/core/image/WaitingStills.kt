package com.metaglance.core.image

/** A still photo that waits for the answer to a prompt. After `maxWaitMs` its scene is gone, and it is dropped. */
enum class WaitingStill(val maxWaitMs: Long) {
    /** A person at the computer waits for this picture and holds the product up. */
    REFERENCE(30_000),

    /** The still for look-alike products shows what the shopper holds now. */
    SECOND_LOOK(5000)
}

/**
 * Keeps the stills that must not start while a prompt waits for a head answer: a still stalls the motion
 * samples for seconds, and the nod of the shopper is lost. A still that waits uses no time of `StillPolicy`.
 * The label still waits in `LabelPolicy`, in the frame path. Call each function on one thread.
 */
class WaitingStills {
    private val since = HashMap<WaitingStill, Long>()

    /** A second request for a kind that waits changes nothing. */
    fun add(still: WaitingStill, nowMs: Long) {
        since.putIfAbsent(still, nowMs)
    }

    /**
     * Call it when no prompt waits and no capture runs. Returns the one still to start now, or null.
     * `onDropped` gets each still that waited too long.
     */
    fun next(nowMs: Long, onDropped: (WaitingStill) -> Unit = {}): WaitingStill? {
        for (still in WaitingStill.entries) {
            val addedMs = since.remove(still) ?: continue
            if (nowMs - addedMs <= still.maxWaitMs) return still
            onDropped(still)
        }
        return null
    }
}
