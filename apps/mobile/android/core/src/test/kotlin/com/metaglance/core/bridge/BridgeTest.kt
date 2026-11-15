package com.metaglance.core.bridge

import com.metaglance.core.contract.Codec
import com.metaglance.core.contract.NativeToPage
import com.metaglance.core.contract.Profiles
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BridgeTest {
    @Test fun `wraps the message as one JavaScript string argument`() {
        val message = NativeToPage.ProfileChanged(Profiles.DEFAULT)
        val call = Bridge.receiveCall(message)
        assertTrue(call.startsWith("window.__glanceReceive(\""))
        assertTrue(call.endsWith("\")"))
        val literal = call.removePrefix("window.__glanceReceive(").removeSuffix(")")
        assertEquals(Codec.encode(message), Json.decodeFromString<String>(literal))
    }

    @Test fun `escapes quotes, backslashes, and line breaks`() {
        val event = buildJsonObject {
            put("type", "error")
            put("code", "x")
            put("message", "a \"b\" \\ \n </script>")
        }
        val call = Bridge.receiveCall(NativeToPage.Event(event))
        assertFalse(call.contains("\n"))
        val literal = call.removePrefix("window.__glanceReceive(").removeSuffix(")")
        assertEquals(Codec.encode(NativeToPage.Event(event)), Json.decodeFromString<String>(literal))
    }

    @Test fun `knows the MIME types of a Vite build`() {
        assertEquals(
            listOf(
                "text/html",
                "text/javascript",
                "text/javascript",
                "text/css",
                "image/svg+xml",
                "application/json",
                "font/woff2",
                "image/png",
                "application/wasm",
                "application/octet-stream"
            ),
            listOf("index.html", "assets/index-abc.js", "a.mjs", "a.css", "a.svg", "a.json", "a.woff2", "a.png", "a.wasm", "a.unknown").map(Bridge::mimeType)
        )
    }

    @Test fun `reads the extension of the file name only, in each letter case`() {
        assertEquals("text/javascript", Bridge.mimeType("assets/v1.2/INDEX.JS"))
        assertEquals("application/octet-stream", Bridge.mimeType("assets.v2/readme"))
        assertEquals("application/octet-stream", Bridge.mimeType(""))
    }
}
