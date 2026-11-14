package com.metaglance.core.frame

import com.metaglance.core.contract.GlanceJson
import java.nio.ByteBuffer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException

/** No kind means `FRAME`. A `LABEL` is a still of a barcode that the phone did not read. */
@Serializable
enum class FrameKind {
    @SerialName("frame")
    FRAME,

    @SerialName("still")
    STILL,

    @SerialName("label")
    LABEL
}

/**
 * `ts` is the capture time in milliseconds since the Unix epoch. `w` and `h` are the size of the JPEG.
 * `blurred` is false when the frame did not go through face detection.
 */
@Serializable
data class FrameHeader(
    val seq: Int,
    val ts: Long,
    val w: Int,
    val h: Int,
    val blurred: Boolean,
    val kind: FrameKind? = null
)

class FrameFormatError(message: String) : Exception(message)

const val MAX_FRAME_HEADER_BYTES = 1024

/**
 * Layout of a frame message:
 * bytes 0 to 3 hold the header length N as an unsigned 32-bit big-endian number,
 * bytes 4 to 4+N hold the header as UTF-8 JSON,
 * and the rest is the JPEG, which starts with 0xFF 0xD8.
 */
object FrameCodec {
    private const val LENGTH_BYTES = 4

    /** Builds a frame message. It does not check the JPEG bytes. */
    fun encode(header: FrameHeader, jpeg: ByteArray): ByteArray {
        val headerBytes = GlanceJson.encodeToString(FrameHeader.serializer(), header).toByteArray(Charsets.UTF_8)
        if (headerBytes.size > MAX_FRAME_HEADER_BYTES) {
            throw FrameFormatError("The frame header has ${headerBytes.size} bytes. The limit is $MAX_FRAME_HEADER_BYTES.")
        }
        return ByteBuffer.allocate(LENGTH_BYTES + headerBytes.size + jpeg.size)
            .putInt(headerBytes.size)
            .put(headerBytes)
            .put(jpeg)
            .array()
    }

    /** Reads a frame message. Throws [FrameFormatError] for each message that does not have the layout above. */
    fun decode(message: ByteArray): Pair<FrameHeader, ByteArray> {
        if (message.size < LENGTH_BYTES) throw FrameFormatError("The frame message is shorter than 4 bytes.")
        // A length with the top bit set is negative as an Int. It is larger than the limit as an unsigned number.
        val headerLength = ByteBuffer.wrap(message).int
        if (headerLength < 0 || headerLength > MAX_FRAME_HEADER_BYTES) {
            throw FrameFormatError("The frame header has ${headerLength.toUInt()} bytes. The limit is $MAX_FRAME_HEADER_BYTES.")
        }
        val jpegStart = LENGTH_BYTES + headerLength
        if (jpegStart > message.size) throw FrameFormatError("The header length is larger than the frame message.")

        val header = try {
            GlanceJson.decodeFromString(FrameHeader.serializer(), String(message, LENGTH_BYTES, headerLength, Charsets.UTF_8))
        } catch (_: SerializationException) {
            throw FrameFormatError("The frame header is not the JSON of a frame header.")
        } catch (_: IllegalArgumentException) {
            throw FrameFormatError("The frame header is not the JSON of a frame header.")
        }

        if (message.size - jpegStart < 2 || message[jpegStart] != 0xFF.toByte() || message[jpegStart + 1] != 0xD8.toByte()) {
            throw FrameFormatError("The frame body does not start with the JPEG start bytes.")
        }
        return header to message.copyOfRange(jpegStart, message.size)
    }
}
