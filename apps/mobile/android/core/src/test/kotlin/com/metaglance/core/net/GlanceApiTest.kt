package com.metaglance.core.net

import com.metaglance.core.contract.CreateSessionResponse
import com.metaglance.core.contract.Profiles
import java.io.IOException
import java.net.InetAddress
import kotlinx.serialization.json.JsonPrimitive
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class GlanceApiTest {
    private val server = MockWebServer()
    private val client = OkHttpClient()
    private lateinit var api: GlanceApi

    @Before fun start() {
        server.start(InetAddress.getByName("127.0.0.1"), 0)
        api = GlanceApi(client, "http://127.0.0.1:${server.port}")
    }

    @After fun stop() {
        server.shutdown()
        client.dispatcher.executorService.shutdown()
        client.connectionPool.evictAll()
    }

    @Test fun `creates a session with the profile`() {
        server.enqueue(MockResponse().setBody("""{"sessionId":"s-1","token":"t-1","wsUrl":"ws://x.test/ws/device"}"""))
        assertEquals(CreateSessionResponse("s-1", "t-1", "ws://x.test/ws/device"), api.createSession(Profiles.DEFAULT))
        val request = server.takeRequest()
        assertEquals("POST /api/sessions HTTP/1.1", request.requestLine)
        assertTrue(request.body.readUtf8().startsWith("""{"profile":{"lang":"en""""))
    }

    @Test fun `reads a snapshot and deletes a session with the token`() {
        server.enqueue(MockResponse().setBody("""{"sessionId":"s-1"}"""))
        server.enqueue(MockResponse().setResponseCode(204))
        assertEquals(JsonPrimitive("s-1"), api.snapshot("s-1", "t-1")["sessionId"])
        assertEquals("/api/sessions/s-1?token=t-1", server.takeRequest().path)
        api.deleteSession("s-1", "t-1")
        assertEquals("DELETE /api/sessions/s-1?token=t-1 HTTP/1.1", server.takeRequest().requestLine)
    }

    @Test fun `throws on an error status`() {
        server.enqueue(MockResponse().setResponseCode(500))
        assertThrows(IOException::class.java) { api.createSession(Profiles.DEFAULT) }
    }

    @Test fun `throws on an answer that is not the JSON of the contract`() {
        server.enqueue(MockResponse().setBody("<html>proxy</html>"))
        assertThrows(IOException::class.java) { api.createSession(Profiles.DEFAULT) }
        server.enqueue(MockResponse().setBody("""{"sessionId":"s-1"}"""))
        assertThrows(IOException::class.java) { api.createSession(Profiles.DEFAULT) }
    }

    @Test fun `puts the socket URL and each clip URL on the server address of the app`() {
        val lan = GlanceApi(client, "http://192.168.1.20:8080")
        assertEquals("ws://192.168.1.20:8080/ws/device?session=s-1&token=t-1", lan.socketUrl("ws://localhost:8080/ws/device?session=s-1&token=t-1"))
        assertEquals("http://192.168.1.20:8080/api/speech/abc.mp3", lan.clipUrl("http://localhost:8080/api/speech/abc.mp3"))
        assertEquals("http://192.168.1.20:8080/clip.wav", lan.clipUrl("/clip.wav"))
        val live = GlanceApi(client, "https://glance.example")
        assertEquals("wss://glance.example/ws/device?session=s-1&token=t-1", live.socketUrl("wss://glance.example/ws/device?session=s-1&token=t-1"))
    }

    @Test fun `ignores a slash at the end of the server address`() {
        val lan = GlanceApi(client, "http://192.168.1.20:8080/")
        assertEquals("http://192.168.1.20:8080/clip.wav", lan.clipUrl("/clip.wav"))
    }
}
