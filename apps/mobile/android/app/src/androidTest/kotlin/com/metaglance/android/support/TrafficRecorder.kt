package com.metaglance.android.support

import com.metaglance.android.session.SessionController
import com.metaglance.core.contract.Codec
import com.metaglance.core.contract.DeviceToServer
import com.metaglance.core.contract.ServerEvent
import com.metaglance.core.contract.ServerToDevice
import com.metaglance.core.frame.FrameHeader
import com.metaglance.core.state.NativeError
import java.util.concurrent.CopyOnWriteArrayList

/** Keeps each message between the app and the server, in the order of arrival. */
class TrafficRecorder : SessionController.Tap {
    class Frame(val header: FrameHeader, val jpegBytes: Int, val atMs: Long)

    /** The messages that went out on an open socket. */
    val toServer = CopyOnWriteArrayList<DeviceToServer>()

    /** The messages that the app dropped, because the socket was down. */
    val notSent = CopyOnWriteArrayList<DeviceToServer>()
    val frames = CopyOnWriteArrayList<Frame>()
    val fromServer = CopyOnWriteArrayList<ServerToDevice>()

    /** The codes of the error events of the app itself. */
    val nativeErrors = CopyOnWriteArrayList<String>()

    /** The lines of the app itself, which the phone voice speaks. */
    val localLines = CopyOnWriteArrayList<String>()

    override fun onToServer(message: DeviceToServer, sent: Boolean) {
        (if (sent) toServer else notSent).add(message)
    }

    override fun onFrame(header: FrameHeader, jpegBytes: Int, sent: Boolean) {
        if (sent) frames.add(Frame(header, jpegBytes, System.currentTimeMillis()))
    }

    override fun onFromServer(message: ServerToDevice) {
        fromServer.add(message)
    }

    override fun onNativeError(error: NativeError) {
        nativeErrors.add(error.code)
    }

    override fun onLocalLine(text: String) {
        localLines.add(text)
    }

    fun events(): List<ServerEvent> = fromServer.filterIsInstance<ServerToDevice.Event>().mapNotNull { Codec.decodeServerEvent(it.event) }

    inline fun <reified T : ServerEvent> event(match: (T) -> Boolean = { true }): T? = events().filterIsInstance<T>().firstOrNull(match)

    inline fun <reified T : DeviceToServer> sent(match: (T) -> Boolean = { true }): T? = toServer.filterIsInstance<T>().firstOrNull(match)

    /** One line for a failure message. */
    fun summary(): String {
        val out = toServer.groupingBy { it::class.simpleName }.eachCount()
        val events = events().map { it::class.simpleName }
        return "sent=$out notSent=${notSent.size} frames=${frames.size} events=$events errors=$nativeErrors"
    }
}
