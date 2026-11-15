package com.metaglance.core.image

/**
 * The sharp second look as a setting of the app. The phone cannot read `SECOND_LOOK_WAIT_MS` of the server, and
 * with the default of that setting the server waits for no such still. Each still stalls the motion samples for
 * seconds: in the session of 2026-11-14 one took 4.8 seconds, and the samples came back 2.7 seconds after it.
 */
object SecondLook {
    /** The default of `glance.secondLookStill` in the build of the app. */
    const val DEFAULT_ON = false

    fun logLine(on: Boolean): String = "second look still: ${state(on)}"

    /** The item of "Glance Mock". */
    fun menuLabel(on: Boolean): String = "Second look still: ${state(on)}"

    private fun state(on: Boolean) = if (on) "on" else "off"
}

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
 * `LabelPolicy` holds the label still back, in the frame path. Call each function on one thread.
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
