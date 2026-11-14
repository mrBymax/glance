package com.metaglance.core.net

import com.metaglance.core.contract.DeviceToServer
import com.metaglance.core.contract.Lang
import com.metaglance.core.contract.Priority
import com.metaglance.core.contract.ServerToDevice
import com.metaglance.core.frame.FrameCodec
import com.metaglance.core.frame.FrameHeader
import java.net.InetAddress
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import okhttp3.OkHttpClient
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okio.ByteString
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class DeviceSocketTest {
    /** Keeps each delay, and runs a block only when the test asks for it. */
    private class FakeScheduler : Scheduler {
        val delays = CopyOnWriteArrayList<Long>()
        private val blocks = LinkedBlockingQueue<() -> Unit>()

        override fun schedule(delayMs: Long, block: () -> Unit): () -> Unit {
            delays.add(delayMs)
            blocks.add(block)
            return { blocks.remove(block) }
        }

        fun runNext() = blocks.remove().invoke()
    }

    private val server = MockWebServer()
    private val client = OkHttpClient()
    private val scheduler = FakeScheduler()

    /** The listener calls in order: `open` and `down`. */
    private val events = CopyOnWriteArrayList<String>()
    private val signals = LinkedBlockingQueue<String>()
    private val messages = LinkedBlockingQueue<ServerToDevice>()
    private val peers = LinkedBlockingQueue<WebSocket>()
    private val textOnServer = LinkedBlockingQueue<String>()
    private val binaryOnServer = LinkedBlockingQueue<ByteArray>()

    private lateinit var socket: DeviceSocket
    private lateinit var peer: WebSocket

    private val serverSide = object : WebSocketListener() {
        override fun onOpen(webSocket: WebSocket, response: Response) {
            peers.add(webSocket)
        }

        override fun onMessage(webSocket: WebSocket, text: String) {
            textOnServer.add(text)
        }

        override fun onMessage(webSocket: WebSocket, bytes: ByteString) {
            binaryOnServer.add(bytes.toByteArray())
        }

        override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
            webSocket.close(code, null)
        }
    }

    private val listener = object : DeviceSocket.Listener {
        override fun onOpen() = signal("open")

        override fun onMessage(message: ServerToDevice) {
            messages.add(message)
        }

        override fun onDown() = signal("down")

        private fun signal(name: String) {
            events.add(name)
            signals.add(name)
        }
    }

    @Before fun start() {
        server.start(InetAddress.getByName("127.0.0.1"), 0)
        // One answer for the first connection, and one for the connection after a drop.
        repeat(2) { server.enqueue(MockResponse().withWebSocketUpgrade(serverSide)) }
        socket = DeviceSocket(client, "ws://127.0.0.1:${server.port}/ws/device?session=s-1&token=t-1", scheduler, listener)
    }

    @After fun stop() {
        socket.close()
        server.shutdown()
        client.dispatcher.executorService.shutdown()
        client.connectionPool.evictAll()
    }

    private fun <T> await(queue: LinkedBlockingQueue<T>, what: String): T {
        val value = queue.poll(2, TimeUnit.SECONDS)
        assertNotNull("No $what arrived in 2 seconds.", value)
        return value!!
    }

    private fun awaitOpen() {
        assertEquals("open", await(signals, "open call"))
        peer = await(peers, "server side of the socket")
    }

    private fun awaitDown() = assertEquals("down", await(signals, "down call"))

    private fun awaitMessage(): ServerToDevice = await(messages, "message")

    private fun awaitTextOnServer(): String = await(textOnServer, "text message on the server")

    private fun awaitBinaryOnServer(): ByteArray = await(binaryOnServer, "binary message on the server")

    @Test fun `opens the socket and delivers a speak message`() {
        socket.connect()
        awaitOpen()
        peer.send("""{"t":"speak","id":"s-1","priority":"normal","text":"Skipped.","lang":"en","url":null,"sound":null,"interrupt":false,"promptId":null}""")
        assertEquals(ServerToDevice.Speak("s-1", Priority.NORMAL, "Skipped.", Lang.EN, null, null, false, null), awaitMessage())
    }

    @Test fun `ignores a message of a newer server and stays open`() {
        socket.connect()
        awaitOpen()
        peer.send("""{"t":"launch.rocket"}""")
        peer.send("""{"t":"session.rest"}""")
        assertEquals(ServerToDevice.SessionRest, awaitMessage())
        assertTrue(socket.isOpen)
    }

    @Test fun `sends a frame as one binary message in the Plan 0 layout`() {
        socket.connect()
        awaitOpen()
        val header = FrameHeader(1, 1794600000000, 432, 768, false)
        val jpeg = byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 1)
        assertTrue(socket.sendFrame(header, jpeg))
        assertArrayEquals(FrameCodec.encode(header, jpeg), awaitBinaryOnServer())
    }

    @Test fun `sends a text message that the contract knows`() {
        socket.connect()
        awaitOpen()
        socket.send(DeviceToServer.PromptDone("p-0001"))
        assertEquals("""{"t":"prompt.done","promptId":"p-0001"}""", awaitTextOnServer())
    }

    @Test fun `sends nothing before the socket is open`() {
        assertFalse(socket.isOpen)
        assertFalse(socket.send(DeviceToServer.PromptDone("p-0001")))
        assertFalse(socket.sendFrame(FrameHeader(1, 0, 2, 2, false), byteArrayOf(0xFF.toByte(), 0xD8.toByte())))
        assertEquals(0L, socket.queuedBytes())
    }

    @Test fun `connects again with backoff after the server closes`() {
        socket.connect()
        awaitOpen()
        peer.close(1001, "bye")
        awaitDown()
        assertFalse(socket.send(DeviceToServer.PromptDone("p-0001")))
        assertEquals(listOf(500L), scheduler.delays)
        scheduler.runNext()
        awaitOpen()
        assertEquals(listOf("open", "down", "open"), events)
    }

    @Test fun `waits longer after each failed connection, and starts again at 500 ms after an open socket`() {
        val refused = MockWebServer()
        refused.start(InetAddress.getByName("127.0.0.1"), 0)
        repeat(2) { refused.enqueue(MockResponse().setResponseCode(503)) }
        refused.enqueue(MockResponse().withWebSocketUpgrade(serverSide))
        refused.enqueue(MockResponse().setResponseCode(503))
        val other = DeviceSocket(client, "ws://127.0.0.1:${refused.port}/ws/device", scheduler, listener)
        try {
            other.connect()
            awaitDown()
            scheduler.runNext()
            awaitDown()
            assertEquals(listOf(500L, 1000L), scheduler.delays)
            scheduler.runNext()
            awaitOpen()
            peer.close(1001, "bye")
            awaitDown()
            assertEquals(listOf(500L, 1000L, 500L), scheduler.delays)
        } finally {
            other.close()
            refused.shutdown()
        }
    }

    @Test fun `does not connect again after close`() {
        socket.connect()
        awaitOpen()
        socket.close()
        assertFalse(socket.isOpen)
        assertEquals(emptyList<Long>(), scheduler.delays)
    }

    @Test fun `a close during the wait for the next connection cancels it`() {
        socket.connect()
        awaitOpen()
        peer.close(1001, "bye")
        awaitDown()
        socket.close()
        assertThrows(NoSuchElementException::class.java) { scheduler.runNext() }
        assertEquals(listOf("open", "down"), events)
    }

    @Test fun `the delay grows to 8 seconds and stays there`() {
        assertEquals(listOf(500L, 1000L, 2000L, 4000L, 8000L, 8000L), (0..5).map { Backoff().delayMs(it) })
    }
}
