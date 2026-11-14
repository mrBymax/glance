package com.metaglance.core.integration

import com.metaglance.core.contract.CartChangeKind
import com.metaglance.core.contract.Codec
import com.metaglance.core.contract.DeviceState
import com.metaglance.core.contract.DeviceToServer
import com.metaglance.core.contract.GlanceJson
import com.metaglance.core.contract.IntentKind
import com.metaglance.core.contract.IntentSource
import com.metaglance.core.contract.Lang
import com.metaglance.core.contract.Link
import com.metaglance.core.contract.PendingKind
import com.metaglance.core.contract.Phase
import com.metaglance.core.contract.Profiles
import com.metaglance.core.contract.ServerEvent
import com.metaglance.core.contract.ServerToDevice
import com.metaglance.core.contract.SessionSnapshot
import com.metaglance.core.contract.SoundName
import com.metaglance.core.contract.StreamStatus
import com.metaglance.core.frame.FrameHeader
import com.metaglance.core.net.DeviceSocket
import com.metaglance.core.net.GlanceApi
import com.metaglance.core.net.Scheduler
import java.awt.image.BufferedImage
import java.io.ByteArrayOutputStream
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.locks.ReentrantLock
import javax.imageio.ImageIO
import kotlin.concurrent.withLock
import kotlinx.serialization.json.JsonObject
import okhttp3.OkHttpClient
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Plays one shop against a real Glance server in fake mode, with the real [GlanceApi], [DeviceSocket], and codecs.
 *
 * `scripts/integration/server-kotlin.mjs` starts the server and gives its address as the system property
 * `glance.serverUrl`. The server plays `scripts/integration/server-kotlin.fake-script.json`: it sees the product
 * [PRODUCT_ID] from 1.5 seconds after the socket opens. The server has the kiosk of [KIOSK_TEXT] from its start.
 */
class ServerSpineTest {
    /** Each message of the server, until a step of the test takes it. */
    private class Inbox {
        private val lock = ReentrantLock()
        private val arrived = lock.newCondition()
        private val waiting = ArrayList<ServerToDevice>()
        private val all = ArrayList<ServerToDevice>()

        fun add(message: ServerToDevice) = lock.withLock {
            waiting.add(message)
            all.add(message)
            arrived.signalAll()
        }

        /**
         * Returns the first value that `pick` gives for a message, and removes that message. The steps of the server
         * send events at once and lines after their clip, so the order of two messages of one step is not fixed.
         */
        fun <T : Any> take(what: String, pick: (ServerToDevice) -> T?): T {
            lock.lock()
            try {
                var leftNs = TimeUnit.SECONDS.toNanos(STEP_TIMEOUT_S)
                while (true) {
                    for (index in waiting.indices) {
                        val hit = pick(waiting[index]) ?: continue
                        waiting.removeAt(index)
                        return hit
                    }
                    if (leftNs <= 0) {
                        throw AssertionError("No $what arrived in $STEP_TIMEOUT_S seconds. The server sent:\n" + all.joinToString("\n"))
                    }
                    leftNs = arrived.awaitNanos(leftNs)
                }
            } finally {
                lock.unlock()
            }
        }
    }

    private val serverUrl = System.getProperty("glance.serverUrl")
        ?: error("The system property glance.serverUrl is not set. Run node scripts/integration/server-kotlin.mjs at the repository root.")
    private val client = OkHttpClient.Builder().pingInterval(PING_S, TimeUnit.SECONDS).build()
    private val api = GlanceApi(client, serverUrl)

    private val inbox = Inbox()
    private val opened = CountDownLatch(1)
    private val downs = CopyOnWriteArrayList<String>()
    private val socketLog = CopyOnWriteArrayList<String>()
    private val unknownEvents = CopyOnWriteArrayList<String>()
    private var socket: DeviceSocket? = null

    private val listener = object : DeviceSocket.Listener {
        override fun onOpen() = opened.countDown()

        override fun onMessage(message: ServerToDevice) {
            if (message is ServerToDevice.Event && Codec.decodeServerEvent(message.event) == null) {
                unknownEvents.add(message.event.toString())
            }
            inbox.add(message)
        }

        override fun onDown() {
            downs.add("down")
        }
    }

    // A socket that goes down fails the test, so no new connection starts.
    private val noRetry = Scheduler { _, _ -> {} }

    @After fun stop() {
        socket?.close()
        client.dispatcher.executorService.shutdown()
        client.connectionPool.evictAll()
    }

    private fun send(message: DeviceToServer) = assertTrue("The socket did not take $message.", socket!!.send(message))

    private fun speak(what: String, accept: (ServerToDevice.Speak) -> Boolean): ServerToDevice.Speak = inbox.take(what) { message -> (message as? ServerToDevice.Speak)?.takeIf(accept) }

    private inline fun <reified E : ServerEvent> event(what: String, crossinline accept: (E) -> Boolean = { true }): E = inbox.take(what) { message ->
        val event = (message as? ServerToDevice.Event)?.let { Codec.decodeServerEvent(it.event) }
        (event as? E)?.takeIf { accept(it) }
    }

    private fun decodeSnapshot(session: JsonObject): SessionSnapshot = GlanceJson.decodeFromJsonElement(SessionSnapshot.serializer(), session)

    private fun jpeg(): ByteArray {
        val bytes = ByteArrayOutputStream()
        assertTrue(ImageIO.write(BufferedImage(FRAME_WIDTH, FRAME_HEIGHT, BufferedImage.TYPE_INT_RGB), "jpg", bytes))
        return bytes.toByteArray()
    }

    @Test fun `one shop from the session start to the receipt`() {
        val created = api.createSession(Profiles.DEFAULT)
        val socketUrl = api.socketUrl(created.wsUrl)
        assertTrue("The socket address is $socketUrl.", socketUrl.startsWith("ws" + serverUrl.removePrefix("http") + "/ws/device?session="))

        socket = DeviceSocket(client, socketUrl, noRetry, listener, log = { socketLog.add(it) }).also { it.connect() }
        assertTrue("The socket did not open in $STEP_TIMEOUT_S seconds. $socketLog", opened.await(STEP_TIMEOUT_S, TimeUnit.SECONDS))

        val first = decodeSnapshot(inbox.take("snapshot") { (it as? ServerToDevice.Snapshot)?.session })
        assertEquals(created.sessionId, first.sessionId)
        assertEquals(Phase.SHOPPING, first.phase)
        assertFalse(first.cameraOn)
        assertEquals(Profiles.DEFAULT, first.profile)
        assertEquals(emptyList<Any>(), first.cart.items)

        send(DeviceToServer.DeviceStateChanged(DeviceState(Link.CONNECTED, 80, true, true, 0, StreamStatus.STREAMING)))
        event<ServerEvent.SessionState>("session.state with the camera on") { it.phase == Phase.SHOPPING && it.cameraOn }
        val cameraOn = speak("line with no prompt ID") { it.promptId == null }
        assertTrue("The first line is \"${cameraOn.text}\".", cameraOn.text.startsWith("Camera on."))
        assertEquals(Lang.EN, cameraOn.lang)
        assertNull("A server with FAKE_SPEECH sends no clip address.", cameraOn.url)

        // The runner script reads the log of the server and checks that each of these frames decoded there.
        val jpeg = jpeg()
        for (seq in 1..FRAME_COUNT) {
            assertTrue(socket!!.sendFrame(FrameHeader(seq, System.currentTimeMillis(), FRAME_WIDTH, FRAME_HEIGHT, blurred = true), jpeg))
        }

        val pending = event<ServerEvent.GlancePending>("glance.pending")
        assertEquals(PRODUCT_ID, pending.product.id)
        assertEquals(PendingKind.NEW, pending.kind)
        assertEquals(0, pending.qtyInCart)
        val productLine = speak("line of the product prompt") { it.promptId == pending.promptId }
        assertTrue(productLine.text.isNotBlank())

        send(DeviceToServer.PromptDone(pending.promptId))
        send(DeviceToServer.Intent(IntentKind.YES, IntentSource.HEAD, pending.promptId))
        event<ServerEvent.GlanceCleared>("glance.cleared of the product prompt") { it.promptId == pending.promptId }
        val added = event<ServerEvent.CartUpdated>("cart.updated with an add") { it.change?.kind == CartChangeKind.ADD }
        assertEquals(PRODUCT_ID, added.change?.productId)
        assertEquals(1, added.cart.items.size)
        val item = added.cart.items.single()
        assertEquals(PRODUCT_ID, item.productId)
        assertEquals(1, item.qty)
        assertEquals(pending.product.priceCents, item.unitPriceCents)
        assertEquals(pending.product.priceCents, added.cart.totalCents)
        speak("line of the add") { it.sound == SoundName.ADDED }

        send(DeviceToServer.KioskSeen(KIOSK_TEXT))
        event<ServerEvent.SessionState>("session.state with the phase checkout") { it.phase == Phase.CHECKOUT }
        val offered = event<ServerEvent.CheckoutOffered>("checkout.offered")
        assertEquals("Checkout 3", offered.kiosk.name)
        assertEquals("Demo Market", offered.kiosk.store)
        assertEquals(added.cart.totalCents, offered.totalCents)
        assertEquals(1, offered.itemCount)
        assertFalse(offered.needsBiometric)
        speak("line of the pay prompt") { it.promptId == offered.promptId }

        send(DeviceToServer.PromptDone(offered.promptId))
        send(DeviceToServer.Intent(IntentKind.YES, IntentSource.HEAD, offered.promptId))
        val paid = event<ServerEvent.CheckoutPaid>("checkout.paid")
        assertTrue(paid.orderId.isNotBlank())
        assertEquals(offered.totalCents, paid.totalCents)
        assertEquals(added.cart.items, paid.items)
        assertEquals(offered.kiosk, paid.kiosk)
        event<ServerEvent.CartUpdated>("cart.updated with an empty cart") { it.change == null && it.cart.items.isEmpty() }
        event<ServerEvent.SessionState>("session.state with the phase paid") { it.phase == Phase.PAID && !it.cameraOn }
        speak("line of the payment") { it.sound == SoundName.PAID }
        inbox.take("session.end") { it as? ServerToDevice.SessionEnd }

        val last = decodeSnapshot(api.snapshot(created.sessionId, created.token))
        assertEquals(Phase.PAID, last.phase)
        assertEquals(paid.orderId, last.lastReceipt?.orderId)
        assertEquals(paid.totalCents, last.lastReceipt?.totalCents)
        assertEquals(emptyList<Any>(), last.cart.items)
        assertNull(last.prompt)

        assertEquals("The Kotlin codec does not know an event of the server.", emptyList<String>(), unknownEvents)
        assertEquals("The socket dropped a message or failed.", emptyList<String>(), socketLog)
        assertEquals("The socket went down.", emptyList<String>(), downs)
    }

    private companion object {
        const val STEP_TIMEOUT_S = 10L
        const val PING_S = 20L
        const val PRODUCT_ID = "oat-drink-1l"
        const val KIOSK_TEXT = "GL1 K3X7"

        // The runner script expects 3 frames of this size in the log of the server.
        const val FRAME_COUNT = 3
        const val FRAME_WIDTH = 432
        const val FRAME_HEIGHT = 768
    }
}
