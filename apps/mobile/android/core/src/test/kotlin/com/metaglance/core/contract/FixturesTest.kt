package com.metaglance.core.contract

import java.io.File
import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.double
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class FixturesTest {
    private val root = File(System.getProperty("glance.fixtures") ?: "").also {
        check(it.isDirectory) { "fixtures not found: ${it.path}" }
    }

    private class Fixture(val folder: String, val name: String, val text: String) {
        val tree: JsonObject get() = GlanceJson.parseToJsonElement(text).jsonObject
        val label: String get() = "$folder/$name"
    }

    private fun folder(name: String): List<Fixture> = File(root, name).listFiles { f -> f.name.endsWith(".json") }!!
        .sortedBy { it.name }
        .map { Fixture(name, it.name.removeSuffix(".json"), it.readText()) }

    private fun counts(): Map<String, Int> = root.list()!!.associateWith { folder(it).size }

    // 1 and 1.0 are the same JSON number. The Kotlin encoder writes a Double with a decimal point.
    private fun numbersAsDoubles(element: JsonElement): JsonElement = when (element) {
        is JsonObject -> JsonObject(element.mapValues { numbersAsDoubles(it.value) })
        is JsonArray -> JsonArray(element.map { numbersAsDoubles(it) })
        is JsonNull -> element
        is JsonPrimitive -> if (element.isString || element.content == "true" || element.content == "false") {
            element
        } else {
            JsonPrimitive(element.double)
        }
    }

    private fun assertSameJson(label: String, expected: String, actual: String) {
        assertEquals(
            label,
            numbersAsDoubles(GlanceJson.parseToJsonElement(expected)),
            numbersAsDoubles(GlanceJson.parseToJsonElement(actual))
        )
    }

    private fun <T> assertRoundTrip(fixture: Fixture, serializer: KSerializer<T>) {
        val value = GlanceJson.decodeFromString(serializer, fixture.text)
        assertSameJson(fixture.label, fixture.text, GlanceJson.encodeToString(serializer, value))
    }

    @Test fun `knows each fixture folder`() {
        assertEquals(
            setOf(
                "catalog",
                "events",
                "device-to-server",
                "server-to-device",
                "bridge-page-to-native",
                "bridge-native-to-page",
                "rest"
            ),
            root.list()!!.toSet()
        )
    }

    @Test fun `has the fixture counts of Plan 0`() {
        assertEquals(
            mapOf(
                "catalog" to 1,
                "events" to 16,
                "device-to-server" to 9,
                "server-to-device" to 7,
                "bridge-page-to-native" to 10,
                "bridge-native-to-page" to 4,
                "rest" to 8
            ),
            counts()
        )
    }

    @Test fun `decodes each message fixture, and the file name is the wire value`() {
        val decoders: Map<String, (Fixture) -> Any?> = mapOf(
            "events" to { f -> Codec.decodeServerEvent(f.tree) },
            "device-to-server" to { f -> GlanceJson.decodeFromString(DeviceToServer.serializer(), f.text) },
            "server-to-device" to { f -> Codec.decodeServerToDevice(f.text) },
            "bridge-page-to-native" to { f -> Codec.decodePageToNative(f.text) },
            "bridge-native-to-page" to { f -> GlanceJson.decodeFromString(NativeToPage.serializer(), f.text) }
        )
        for ((name, decode) in decoders) {
            val key = if (name == "events") "type" else "t"
            for (fixture in folder(name)) {
                assertNotNull(fixture.label, decode(fixture))
                assertEquals(fixture.label, fixture.name, fixture.tree.getValue(key).jsonPrimitive.content)
            }
        }
    }

    @Test fun `decodes the event and the session inside a message as their types`() {
        val event = Codec.decodeServerToDevice(folder("server-to-device").first { it.name == "event" }.text)
        val pending = Codec.decodeServerEvent((event as ServerToDevice.Event).event) as ServerEvent.GlancePending
        assertEquals(listOf<Warning>(Warning.Allergen(listOf(Allergen.GLUTEN))), pending.warnings)

        val snapshot = Codec.decodeServerToDevice(folder("server-to-device").first { it.name == "snapshot" }.text)
        val session = GlanceJson.decodeFromJsonElement(SessionSnapshot.serializer(), (snapshot as ServerToDevice.Snapshot).session)
        assertEquals("p-0001", (session.prompt as CurrentPrompt.Product).promptId)
        assertEquals(Profiles.DEFAULT, session.profile)
        assertEquals(2, session.captions.size)
    }

    @Test fun `reads each event fixture with each of its fields`() {
        for (fixture in folder("events")) assertRoundTrip(fixture, ServerEvent.serializer())
    }

    @Test fun `decodes the catalog fixture and each rest fixture by the type in its file name`() {
        assertRoundTrip(folder("catalog").single(), Product.serializer())
        val restTypes: Map<String, KSerializer<*>> = mapOf(
            "CartEditRequest" to CartEditRequest.serializer(),
            "CreateKioskRequest" to CreateKioskRequest.serializer(),
            "CreateKioskResponse" to CreateKioskResponse.serializer(),
            "CreateSessionRequest" to CreateSessionRequest.serializer(),
            "CreateSessionResponse" to CreateSessionResponse.serializer(),
            "KioskEvent" to KioskEvent.serializer(),
            "LatestSessionResponse" to LatestSessionResponse.serializer(),
            "WebIntentRequest" to WebIntentRequest.serializer()
        )
        for (fixture in folder("rest")) assertRoundTrip(fixture, restTypes.getValue(fixture.name))
    }

    @Test fun `encodes each message that the app sends back to the same JSON`() {
        for (fixture in folder("device-to-server")) {
            val message = GlanceJson.decodeFromString(DeviceToServer.serializer(), fixture.text)
            assertSameJson(fixture.label, fixture.text, Codec.encode(message))
        }
        for (fixture in folder("bridge-native-to-page")) {
            val message = GlanceJson.decodeFromString(NativeToPage.serializer(), fixture.text)
            assertSameJson(fixture.label, fixture.text, Codec.encode(message))
        }
    }
}
