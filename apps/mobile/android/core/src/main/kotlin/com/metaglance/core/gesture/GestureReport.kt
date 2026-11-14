package com.metaglance.core.gesture

import java.util.Locale

/** Why a pair of opposite strokes is no gesture. `word` is the name in a log line. */
enum class Rejected(val word: String) {
    /** A stroke of a nod is larger than `maxNodRad`. */
    AMPLITUDE("amplitude"),

    /** The top rate of a stroke is below `minPeakRadS`. */
    PEAK("peak"),

    /** The pair takes longer than `maxNodMs` or `maxShakeMs`. */
    TIME("time"),

    /** The other axis moved more than the largest stroke divided by `dominance`. */
    DOMINANCE("dominance"),

    /** The second stroke of a nod did not bring the head back near the start. */
    NET_ANGLE("net angle"),

    /** A shake needs the start of a third stroke. A look to the side and back has two strokes. */
    TWO_STROKES("two strokes only")
}

/**
 * What the detector decided about one pair of opposite strokes on the pitch axis (`NOD`) or on the yaw axis
 * (`SHAKE`). `rejected` is null for a gesture that the detector reported. Angles are in rad, rates are in rad/s.
 * `netRad` is the angle between the start of the first stroke and the head at the time of the decision.
 * `otherAxisRad` is the range of the other axis in the time of the pair.
 */
class GestureReport(
    val gesture: HeadGesture,
    val rejected: Rejected?,
    val firstRad: Double,
    val secondRad: Double,
    val firstPeakRadS: Double,
    val secondPeakRadS: Double,
    val ms: Long,
    val netRad: Double,
    val otherAxisRad: Double
) {
    /** One log line, for example `nod rejected (peak): strokes 0.15 and 0.15 rad, ...`. */
    fun line(): String {
        val name = gesture.name.lowercase(Locale.US)
        val outcome = if (rejected == null) "accepted" else "rejected (${rejected.word})"
        return String.format(
            Locale.US,
            "%s %s: strokes %.2f and %.2f rad, peaks %.2f and %.2f rad/s, %d ms, net %.2f rad, other axis %.2f rad",
            name, outcome, firstRad, secondRad, firstPeakRadS, secondPeakRadS, ms, netRad, otherAxisRad
        )
    }
}
