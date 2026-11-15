package com.metaglance.core.frame

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class FrameCodecTest {
    private val jpeg = byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0x01, 0x02, 0xFF.toByte(), 0xD9.toByte())
    private val header = FrameHeader(seq = 7, ts = 1794600000000, w = 576, h = 768, blurred = true)

    private fun hex(bytes: ByteArray) = bytes.joinToString("") { "%02x".format(it) }

    @Test fun `writes the same bytes as encodeFrame of Plan 0`() {
        assertEquals(
            "0000003b7b22736571223a372c227473223a313739343630303030303030302c2277223a3537362c2268223a3736382c22626c7572726564223a747275657dffd80102ffd9",
            hex(FrameCodec.encode(header, jpeg))
        )
    }

    @Test fun `round-trips a frame`() {
        val (h, body) = FrameCodec.decode(FrameCodec.encode(header, jpeg))
        assertEquals(header, h)
        assertArrayEquals(jpeg, body)
    }

    @Test fun `writes kind for a still only`() {
        assertFalse(String(FrameCodec.encode(header, jpeg), Charsets.ISO_8859_1).contains("kind"))
        val still = FrameCodec.encode(header.copy(kind = FrameKind.STILL), jpeg)
        assertTrue(String(still, Charsets.ISO_8859_1).contains("\"kind\":\"still\""))
    }

    @Test fun `round-trips a label frame, and rejects a kind that it does not know`() {
        val label = FrameCodec.encode(header.copy(kind = FrameKind.LABEL), jpeg)
        assertTrue(String(label, Charsets.ISO_8859_1).contains("\"kind\":\"label\""))
        assertEquals(FrameKind.LABEL, FrameCodec.decode(label).first.kind)
        val other = String(label, Charsets.ISO_8859_1).replace("label", "video").toByteArray(Charsets.ISO_8859_1)
        assertThrows(FrameFormatError::class.java) { FrameCodec.decode(other) }
    }

    @Test fun `writes the view, the crop, and the source size after the other fields`() {
        val crop = header.copy(w = 360, h = 716, view = FrameView.CROP, crop = FrameCrop(316, 420, 360, 716), source = FrameSize(720, 1280))
        val message = FrameCodec.encode(crop, jpeg)
        val text = String(message, Charsets.ISO_8859_1)
        assertTrue(text, text.contains("\"blurred\":true,\"view\":\"crop\",\"crop\":{\"x\":316,\"y\":420,\"w\":360,\"h\":716},\"source\":{\"w\":720,\"h\":1280}}"))
        assertEquals(crop, FrameCodec.decode(message).first)
    }

    @Test fun `a full frame of a phone that crops has the view and the source size, and no crop`() {
        val full = header.copy(view = FrameView.FULL, source = FrameSize(504, 896))
        val message = FrameCodec.encode(full, jpeg)
        val text = String(message, Charsets.ISO_8859_1)
        assertTrue(text, text.contains("\"view\":\"full\",\"source\":{\"w\":504,\"h\":896}}"))
        assertFalse(text.contains("\"crop\":"))
        assertEquals(full, FrameCodec.decode(message).first)
    }

    @Test fun `a header with no view has none of the three fields`() {
        val text = String(FrameCodec.encode(header, jpeg), Charsets.ISO_8859_1)
        for (field in listOf("view", "crop", "source")) assertFalse(field, text.contains(field))
        val decoded = FrameCodec.decode(FrameCodec.encode(header, jpeg)).first
        assertNull(decoded.view)
        assertNull(decoded.crop)
        assertNull(decoded.source)
    }

    @Test fun `carries the context image of a crop after the JPEG, and writes its byte count into the header`() {
        val context = byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0x09, 0xFF.toByte(), 0xD9.toByte())
        val crop = header.copy(view = FrameView.CROP, crop = FrameCrop(2, 4, 576, 768), source = FrameSize(720, 1280))
        val message = FrameCodec.encode(crop, jpeg, context)
        assertTrue(String(message, Charsets.ISO_8859_1).contains("\"source\":{\"w\":720,\"h\":1280},\"contextBytes\":5}"))
        assertArrayEquals(context, message.copyOfRange(message.size - 5, message.size))
        val (decoded, body) = FrameCodec.decode(message)
        assertEquals(crop.copy(contextBytes = 5), decoded)
        assertArrayEquals(jpeg, body)
        assertArrayEquals(context, FrameCodec.context(message))
    }

    @Test fun `a frame with no context image has none, and the byte count never comes from the caller`() {
        val message = FrameCodec.encode(header.copy(contextBytes = 3), jpeg)
        assertFalse(String(message, Charsets.ISO_8859_1).contains("contextBytes"))
        assertNull(FrameCodec.context(message))
        assertArrayEquals(jpeg, FrameCodec.decode(message).second)
    }

    @Test fun `rejects a context image that is no JPEG`() {
        assertThrows(FrameFormatError::class.java) { FrameCodec.decode(FrameCodec.encode(header, jpeg, byteArrayOf(1, 2, 3))) }
    }

    @Test fun `rejects a message shorter than 4 bytes`() {
        assertThrows(FrameFormatError::class.java) { FrameCodec.decode(byteArrayOf(0, 0)) }
    }

    @Test fun `rejects a header length larger than the message or larger than the limit`() {
        assertThrows(FrameFormatError::class.java) { FrameCodec.decode(byteArrayOf(0, 0, 0, 200.toByte(), 0x7b, 0x7d)) }
        // Header length 2000
        val overLimit = ByteArray(4 + 2000).also {
            it[2] = 0x07
            it[3] = 0xD0.toByte()
        }
        assertThrows(FrameFormatError::class.java) { FrameCodec.decode(overLimit) }
    }

    @Test fun `rejects a header length with the top bit set`() {
        val negative = byteArrayOf(0x80.toByte(), 0, 0, 0, 0x7b, 0x7d, 0xFF.toByte(), 0xD8.toByte())
        assertThrows(FrameFormatError::class.java) { FrameCodec.decode(negative) }
    }

    @Test fun `rejects a header that is not JSON and a body that is not a JPEG`() {
        assertThrows(FrameFormatError::class.java) {
            FrameCodec.decode(byteArrayOf(0, 0, 0, 2, 0x7b, 0x7b, 0xFF.toByte(), 0xD8.toByte()))
        }
        assertThrows(FrameFormatError::class.java) {
            FrameCodec.decode(FrameCodec.encode(header, byteArrayOf(0x89.toByte(), 0x50)))
        }
    }
}
