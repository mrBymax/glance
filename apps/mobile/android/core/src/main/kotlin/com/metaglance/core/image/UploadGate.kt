package com.metaglance.core.image

enum class UploadSkip { SOCKET_DOWN, STILL_SENDING, NOT_WORN }

object UploadGate {
    /**
     * Returns the reason to skip the upload of a frame, or null to send it.
     * `queuedBytes` is the number of bytes that the socket did not send yet. `worn` is null when the glasses did not report it.
     */
    fun check(socketOpen: Boolean, queuedBytes: Long, worn: Boolean?): UploadSkip? = when {
        !socketOpen -> UploadSkip.SOCKET_DOWN
        queuedBytes > 0 -> UploadSkip.STILL_SENDING
        worn == false -> UploadSkip.NOT_WORN
        else -> null
    }
}
