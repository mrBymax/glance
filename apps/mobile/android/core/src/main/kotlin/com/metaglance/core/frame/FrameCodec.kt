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
 * `CROP`: the JPEG is a part of the source image, around an object that the phone found. `FULL`: the whole source
 * image. No view means a phone that does not crop.
 */
@Serializable
enum class FrameView {
    @SerialName("crop")
    CROP,

    @SerialName("full")
    FULL
}

/** The place of a crop in the source image, in source pixels. */
@Serializable
data class FrameCrop(val x: Int, val y: Int, val w: Int, val h: Int)

/** The size of the source image: the stream frame or the still photo, before the phone cropped or scaled it. */
@Serializable
data class FrameSize(val w: Int, val h: Int)

/**
 * `ts` is the capture time in milliseconds since the Unix epoch. `w` and `h` are the size of the JPEG.
 * `blurred` is false when the frame did not go through face detection. `view`, `crop`, and `source` say what the
 * JPEG shows of the source image. An older server ignores the three.
 */
@Serializable
data class FrameHeader(
    val seq: Int,
    val ts: Long,
    val w: Int,
    val h: Int,
    val blurred: Boolean,
    val kind: FrameKind? = null,
    val view: FrameView? = null,
    val crop: FrameCrop? = null,
    val source: FrameSize? = null,
    /** The byte count of the context image at the end of the message. `FrameCodec.encode` writes it. */
    val contextBytes: Int? = null
)

class FrameFormatError(message: String) : Exception(message)

const val MAX_FRAME_HEADER_BYTES = 1024

/**
 * Layout of a frame message:
 * bytes 0 to 3 hold the header length N as an unsigned 32-bit big-endian number,
 * bytes 4 to 4+N hold the header as UTF-8 JSON,
 * and the rest is the JPEG, which starts with 0xFF 0xD8.
 *
 * A crop can carry a second JPEG behind the first one: the context image, which is the whole source image in a
 * small size. The header field `contextBytes` has its byte count. A JPEG reader stops at the end of the first
 * image, so a server that does not know the field reads the body as the crop.
 */
object FrameCodec {
    private const val LENGTH_BYTES = 4

    /**
     * Builds a frame message. It does not check the JPEG bytes. `context` is the context image of a crop: its
     * byte count goes into the header as `contextBytes`, in place of a value of the caller.
     */
    fun encode(header: FrameHeader, jpeg: ByteArray, context: ByteArray? = null): ByteArray {
        val headerBytes = GlanceJson.encodeToString(FrameHeader.serializer(), header.copy(contextBytes = context?.size)).toByteArray(Charsets.UTF_8)
        if (headerBytes.size > MAX_FRAME_HEADER_BYTES) {
            throw FrameFormatError("The frame header has ${headerBytes.size} bytes. The limit is $MAX_FRAME_HEADER_BYTES.")
        }
        return ByteBuffer.allocate(LENGTH_BYTES + headerBytes.size + jpeg.size + (context?.size ?: 0))
            .putInt(headerBytes.size)
            .put(headerBytes)
            .put(jpeg)
            .put(context ?: ByteArray(0))
            .array()
    }

    /**
     * Reads a frame message: its header and its JPEG, with no context image.
     * Throws [FrameFormatError] for each message that does not have the layout above.
     */
    fun decode(message: ByteArray): Pair<FrameHeader, ByteArray> = read(message).let { it.first to it.second }

    /** The context image of a frame message, or null for a message with none. Throws as [decode] does. */
    fun context(message: ByteArray): ByteArray? = read(message).third

    private fun read(message: ByteArray): Triple<FrameHeader, ByteArray, ByteArray?> {
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

        val contextStart = message.size - (header.contextBytes ?: 0)
        if (!startsAsJpeg(message, jpegStart, contextStart)) throw FrameFormatError("The frame body does not start with the JPEG start bytes.")
        val jpeg = message.copyOfRange(jpegStart, contextStart)
        if (header.contextBytes == null) return Triple(header, jpeg, null)
        if (!startsAsJpeg(message, contextStart, message.size)) throw FrameFormatError("The context image does not start with the JPEG start bytes.")
        return Triple(header, jpeg, message.copyOfRange(contextStart, message.size))
    }

    private fun startsAsJpeg(message: ByteArray, from: Int, to: Int) = to - from >= 2 && message[from] == 0xFF.toByte() && message[from + 1] == 0xD8.toByte()
}
