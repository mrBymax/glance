package com.metaglance.core.image

/** One frame of the stream in I420 layout: Y plane, U plane, V plane. `tUs` is the presentation time of the SDK. */
class RawFrame(val i420: ByteArray, val width: Int, val height: Int, val tUs: Long)
