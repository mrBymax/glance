package com.metaglance.core.input

/** One speech result of the glasses. `confidence` is from 0 to 1, and null if the glasses gave none. */
data class Transcript(val text: String, val isFinal: Boolean, val confidence: Float?, val locale: String?)
