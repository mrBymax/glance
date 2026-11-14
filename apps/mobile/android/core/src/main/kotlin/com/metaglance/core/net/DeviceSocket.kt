package com.metaglance.core.net

import com.metaglance.core.contract.Codec
import com.metaglance.core.contract.DeviceToServer
import com.metaglance.core.contract.ServerToDevice
import com.metaglance.core.frame.FrameCodec
import com.metaglance.core.frame.FrameHeader
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString.Companion.toByteString

/**
 * The device socket to the Glance server (spec section 8.2). It connects again after each close and each failure
 * that the app did not ask for, with the delays of `backoff`.
 *
 * The listener runs on a thread of OkHttp, or on the thread of the scheduler. Build the client with a ping
 * interval, so that a dead link fails.
 */
class DeviceSocket(
    private val client: OkHttpClient,
    private val url: String,
    private val scheduler: Scheduler,
    private val listener: Listener,
    private val backoff: Backoff = Backoff(),
    private val log: (String) -> Unit = {}
) {
    interface Listener {
        fun onOpen()

        fun onMessage(message: ServerToDevice)

        /** The socket closed or failed with no request from the app, or a connection attempt failed. */
        fun onDown()
    }

    private val lock = Any()
    private var socket: WebSocket? = null
    private var open = false
    private var wanted = false
    private var attempt = 0
    private var cancelRetry: (() -> Unit)? = null

    val isOpen: Boolean get() = synchronized(lock) { open }

    /** The number of bytes that wait in the socket. 0 while the socket is down. */
    fun queuedBytes(): Long = synchronized(lock) { if (open) socket?.queueSize() ?: 0 else 0 }

    /** Opens the socket, and keeps it open until [close]. A second call changes nothing. */
    fun connect() {
        synchronized(lock) {
            if (wanted) return
            wanted = true
            attempt = 0
            openSocket()
        }
    }

    /** Closes the socket. No new connection follows, and the listener gets no `onDown`. */
    fun close() {
        val old = synchronized(lock) {
            wanted = false
            open = false
            cancelRetry?.invoke()
            cancelRetry = null
            socket.also { socket = null }
        }
        old?.close(NORMAL_CLOSE, null)
    }

    /** Returns false while the socket is down. A message never waits for a later connection. */
    fun send(message: DeviceToServer): Boolean = current()?.send(Codec.encode(message)) ?: false

    fun sendFrame(header: FrameHeader, jpeg: ByteArray): Boolean = current()?.send(FrameCodec.encode(header, jpeg).toByteString()) ?: false

    private fun current(): WebSocket? = synchronized(lock) { if (open) socket else null }

    // The caller holds the lock.
    private fun openSocket() {
        socket = client.newWebSocket(Request.Builder().url(url).build(), Events())
    }

    private fun onDown(from: WebSocket) {
        synchronized(lock) {
            // A socket that the app closed, or that already reported its end, changes nothing.
            if (socket !== from) return
            socket = null
            open = false
            val delayMs = backoff.delayMs(attempt)
            attempt += 1
            cancelRetry = scheduler.schedule(delayMs) {
                synchronized(lock) {
                    cancelRetry = null
                    if (wanted && socket == null) openSocket()
                }
            }
        }
        listener.onDown()
    }

    private inner class Events : WebSocketListener() {
        override fun onOpen(webSocket: WebSocket, response: Response) {
            synchronized(lock) {
                if (socket !== webSocket) return
                open = true
                attempt = 0
            }
            listener.onOpen()
        }

        override fun onMessage(webSocket: WebSocket, text: String) {
            if (synchronized(lock) { socket !== webSocket }) return
            val message = Codec.decodeServerToDevice(text)
            if (message == null) {
                // A newer server can send a message that this app version does not know.
                log("socket: dropped a message that the contract does not know: ${text.take(MAX_LOGGED_CHARS)}")
            } else {
                listener.onMessage(message)
            }
        }

        override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
            webSocket.close(code, null)
            onDown(webSocket)
        }

        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) = onDown(webSocket)

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            log("socket: failure ${t.javaClass.simpleName}" + (response?.let { " status=${it.code}" } ?: ""))
            onDown(webSocket)
        }
    }

    private companion object {
        const val NORMAL_CLOSE = 1000
        const val MAX_LOGGED_CHARS = 120
    }
}
