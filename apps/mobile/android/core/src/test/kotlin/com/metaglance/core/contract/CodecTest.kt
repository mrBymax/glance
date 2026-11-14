package com.metaglance.core.contract

import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CodecTest {
    @Test fun `leaves out an optional field and writes a nullable field as null`() {
        assertEquals(
            """{"t":"intent","kind":"yes","source":"head"}""",
            Codec.encode(DeviceToServer.Intent(IntentKind.YES, IntentSource.HEAD))
        )
        val state = DeviceState(Link.DISCONNECTED, null, null, null, null, StreamStatus.STOPPED)
        assertEquals(
            """{"t":"device.state","state":{"link":"disconnected","battery":null,"worn":null,"hingeOpen":null,"thermal":null,"stream":"stopped"}}""",
            Codec.encode(DeviceToServer.DeviceStateChanged(state))
        )
    }

    @Test fun `returns null for an unknown message and for text that is not JSON`() {
        assertNull(Codec.decodeServerToDevice("""{"t":"launch.rocket"}"""))
        assertNull(Codec.decodeServerToDevice("x"))
        assertNull(Codec.decodePageToNative("""{"t":"intent","kind":"maybe"}"""))
        assertNull(Codec.decodeServerEvent(JsonObject(mapOf("type" to JsonPrimitive("glance.exploded")))))
    }

    @Test fun `decodes a line with no clip`() {
        val speak = Codec.decodeServerToDevice(
            """{"t":"speak","id":"s-1","priority":"normal","text":"Skipped.","lang":"en","url":null,"sound":null,"interrupt":false,"promptId":null}"""
        )
        assertEquals(ServerToDevice.Speak("s-1", Priority.NORMAL, "Skipped.", Lang.EN, null, null, false, null), speak)
    }

    @Test fun `writes a barcode report with the wire values of its source`() {
        assertEquals(
            """{"t":"barcode.seen","code":"8076809513753","source":"barcode"}""",
            Codec.encode(DeviceToServer.BarcodeSeen("8076809513753", BarcodeSource.BARCODE))
        )
        assertEquals(
            """{"t":"barcode.seen","code":"73513537","source":"ocr"}""",
            Codec.encode(DeviceToServer.BarcodeSeen("73513537", BarcodeSource.OCR))
        )
    }

    @Test fun `decodes a request for a still of a label, and no request with another purpose`() {
        assertEquals(
            ServerToDevice.StillRequest(StillPurpose.LABEL),
            Codec.decodeServerToDevice("""{"t":"still.request","purpose":"label"}""")
        )
        assertNull(Codec.decodeServerToDevice("""{"t":"still.request","purpose":"face"}"""))
        assertNull(Codec.decodeServerToDevice("""{"t":"still.request"}"""))
    }

    @Test fun `has the default profile of Plan 0`() {
        assertEquals(
            Profile(
                Lang.EN, Detail.STANDARD, 1.0, true, true, YesGesture.NOD, 8000, true, MainYes.HEAD,
                emptyList(), false, false, null
            ),
            Profiles.DEFAULT
        )
    }

    @Test fun `applies a profile patch and keeps null as a value`() {
        val patch = buildJsonObject {
            put("headWindowMs", JsonNull)
            put("speechRate", 1.5)
            put("foo", 1)
        }
        val p = Profiles.applyPatch(Profiles.DEFAULT, patch)
        assertNull(p.headWindowMs)
        assertEquals(1.5, p.speechRate, 0.0)
        assertEquals(Profiles.DEFAULT.copy(headWindowMs = null, speechRate = 1.5), p)
        assertEquals(Profiles.DEFAULT, Profiles.applyPatch(Profiles.DEFAULT, buildJsonObject { put("speechRate", "fast") }))
    }

    // The server rejects such a profile, so the app must not keep it.
    @Test fun `a patch with a value outside the limits of Plan 0 changes nothing`() {
        val outside = listOf(
            buildJsonObject { put("speechRate", 0.79) },
            buildJsonObject { put("speechRate", 2.01) },
            buildJsonObject { put("headWindowMs", 9000) },
            buildJsonObject { put("budgetCents", 0) },
            buildJsonObject { put("budgetCents", -100) }
        )
        for (patch in outside) assertEquals(patch.toString(), Profiles.DEFAULT, Profiles.applyPatch(Profiles.DEFAULT, patch))

        val inside = buildJsonObject {
            put("speechRate", 2)
            put("headWindowMs", 15000)
            put("budgetCents", 1)
        }
        assertEquals(
            Profiles.DEFAULT.copy(speechRate = 2.0, headWindowMs = 15000, budgetCents = 1),
            Profiles.applyPatch(Profiles.DEFAULT, inside)
        )
        assertTrue(Profiles.isValid(Profiles.DEFAULT))
        assertFalse(Profiles.isValid(Profiles.DEFAULT.copy(speechRate = 3.0)))
    }
}
