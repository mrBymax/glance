import { z } from 'zod';

// Layout of a frame message:
//   bytes 0 to 3      the header length N, unsigned 32-bit big-endian
//   bytes 4 to 4+N    the header as UTF-8 JSON
//   the rest          the JPEG, which starts with 0xFF 0xD8
// A crop can carry a second JPEG behind the first one: the context image, which is the whole source image in a
// small size. The header field contextBytes has its byte count. A JPEG reader stops at the end of the first image,
// so a server that does not know the field reads the body as the crop.

export const FrameHeaderSchema = z.object({
  seq: z.number().int().min(0),
  // Capture time in milliseconds since the Unix epoch.
  ts: z.number().int().min(0),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
  // false means that the frame did not go through face detection.
  blurred: z.boolean(),
  // No kind means 'frame'. A 'label' is a still of a barcode that the phone did not read.
  kind: z.enum(['frame', 'still', 'label']).optional(),
  // 'crop': the JPEG is a part of the source image, around an object that the phone found. 'full': the whole source image.
  // No view means a phone that does not crop: the whole image.
  view: z.enum(['crop', 'full']).optional(),
  // The place of the JPEG in the source image, in source pixels. Only with the view 'crop'.
  crop: z.object({
    x: z.number().int().min(0), y: z.number().int().min(0), w: z.number().int().positive(), h: z.number().int().positive(),
  }).optional(),
  // The size of the source image: the stream frame or the still photo, before the phone cropped or scaled it.
  source: z.object({ w: z.number().int().positive(), h: z.number().int().positive() }).optional(),
  // The byte count of the context image at the end of the message. encodeFrame writes it.
  contextBytes: z.number().int().positive().optional(),
});
export type FrameHeader = z.infer<typeof FrameHeaderSchema>;

export class FrameFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FrameFormatError';
  }
}

export const MAX_FRAME_HEADER_BYTES = 1024;

const LENGTH_BYTES = 4;

/**
 * Builds a frame message. It does not check the JPEG bytes.
 * `context` is the context image of a crop. Its byte count goes into the header as contextBytes, in place of a
 * value of the caller.
 */
export function encodeFrame(header: FrameHeader, jpeg: Uint8Array, context?: Uint8Array): Uint8Array {
  const { contextBytes: _, ...fields } = header;
  const headerBytes = new TextEncoder().encode(JSON.stringify(context ? { ...fields, contextBytes: context.length } : fields));
  if (headerBytes.length > MAX_FRAME_HEADER_BYTES) {
    throw new FrameFormatError(`The frame header has ${headerBytes.length} bytes. The limit is ${MAX_FRAME_HEADER_BYTES}.`);
  }
  const message = new Uint8Array(LENGTH_BYTES + headerBytes.length + jpeg.length + (context?.length ?? 0));
  new DataView(message.buffer).setUint32(0, headerBytes.length, false);
  message.set(headerBytes, LENGTH_BYTES);
  message.set(jpeg, LENGTH_BYTES + headerBytes.length);
  if (context) message.set(context, LENGTH_BYTES + headerBytes.length + jpeg.length);
  return message;
}

const startsAsJpeg = (bytes: Uint8Array): boolean => bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8;

/**
 * Reads a frame message. The returned JPEG and the context image are views on the message, with no copy.
 * `context` is there only for a header with contextBytes.
 * Throws FrameFormatError for each message that does not have the layout above.
 */
export function decodeFrame(message: Uint8Array): { header: FrameHeader; jpeg: Uint8Array; context?: Uint8Array } {
  if (message.length < LENGTH_BYTES) {
    throw new FrameFormatError('The frame message is shorter than 4 bytes.');
  }
  // The message can be a view inside a larger buffer, so the read starts at its byteOffset.
  const headerLength = new DataView(message.buffer, message.byteOffset, message.byteLength).getUint32(0, false);
  if (headerLength > MAX_FRAME_HEADER_BYTES) {
    throw new FrameFormatError(`The frame header has ${headerLength} bytes. The limit is ${MAX_FRAME_HEADER_BYTES}.`);
  }
  const jpegStart = LENGTH_BYTES + headerLength;
  if (jpegStart > message.length) {
    throw new FrameFormatError('The header length is larger than the frame message.');
  }

  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(message.subarray(LENGTH_BYTES, jpegStart)));
  } catch {
    throw new FrameFormatError('The frame header is not valid JSON.');
  }
  const header = FrameHeaderSchema.safeParse(json);
  if (!header.success) {
    throw new FrameFormatError('The frame header does not have the fields of a frame header.');
  }

  const contextBytes = header.data.contextBytes ?? 0;
  const jpeg = message.subarray(jpegStart, message.length - contextBytes);
  if (!startsAsJpeg(jpeg)) {
    throw new FrameFormatError('The frame body does not start with the JPEG start bytes.');
  }
  if (contextBytes === 0) return { header: header.data, jpeg };
  const context = message.subarray(message.length - contextBytes);
  if (!startsAsJpeg(context)) {
    throw new FrameFormatError('The context image does not start with the JPEG start bytes.');
  }
  return { header: header.data, jpeg, context };
}
