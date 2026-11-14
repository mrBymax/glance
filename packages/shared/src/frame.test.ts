import { describe, expect, it } from 'vitest';
import { type FrameHeader, FrameFormatError, decodeFrame, encodeFrame } from './frame';

const jpeg = new Uint8Array([0xff, 0xd8, 0x01, 0x02, 0xff, 0xd9]);
const header = { seq: 7, ts: 1794600000000, w: 576, h: 768, blurred: true };

describe('frame codec', () => {
  it('round-trips a frame', () => {
    expect(decodeFrame(encodeFrame(header, jpeg))).toEqual({ header, jpeg });
  });
  it('round-trips each frame kind, and rejects a kind that it does not know', () => {
    for (const kind of ['frame', 'still', 'label'] as const) {
      expect(decodeFrame(encodeFrame({ ...header, kind }, jpeg)).header.kind).toBe(kind);
    }
    const other = encodeFrame({ ...header, kind: 'video' } as unknown as FrameHeader, jpeg);
    expect(() => decodeFrame(other)).toThrow(FrameFormatError);
  });
  it('round-trips the view, the crop, and the source size', () => {
    const crop = { ...header, w: 360, h: 716, view: 'crop', crop: { x: 316, y: 420, w: 360, h: 716 }, source: { w: 720, h: 1280 } } as const;
    expect(decodeFrame(encodeFrame(crop, jpeg)).header).toEqual(crop);
    const full = { ...header, view: 'full', source: { w: 720, h: 1280 } } as const;
    expect(decodeFrame(encodeFrame(full, jpeg)).header).toEqual(full);
  });
  it('reads a header of a phone that sends no view', () => {
    const decoded = decodeFrame(encodeFrame(header, jpeg)).header;
    expect(decoded.view).toBeUndefined();
    expect(decoded.crop).toBeUndefined();
    expect(decoded.source).toBeUndefined();
  });
  it('drops a header field that it does not know, as an older server drops the view', () => {
    const newer = encodeFrame({ ...header, zoom: 2 } as unknown as FrameHeader, jpeg);
    expect(decodeFrame(newer).header).toEqual(header);
  });
  it('rejects a view that it does not know, and a crop with no size', () => {
    const view = encodeFrame({ ...header, view: 'zoom' } as unknown as FrameHeader, jpeg);
    expect(() => decodeFrame(view)).toThrow(FrameFormatError);
    const crop = encodeFrame({ ...header, view: 'crop', crop: { x: 0, y: 0, w: 0, h: 10 } } as unknown as FrameHeader, jpeg);
    expect(() => decodeFrame(crop)).toThrow(FrameFormatError);
  });
  it('writes the header length as 4 big-endian bytes', () => {
    const message = encodeFrame(header, jpeg);
    const n = new DataView(message.buffer, message.byteOffset).getUint32(0, false);
    expect(JSON.parse(new TextDecoder().decode(message.subarray(4, 4 + n)))).toEqual(header);
  });
  it('rejects a message shorter than 4 bytes', () => {
    expect(() => decodeFrame(new Uint8Array([0, 0]))).toThrow(FrameFormatError);
  });
  it('rejects a header length larger than the message or larger than the limit', () => {
    const tooLong = new Uint8Array([0, 0, 0, 200, 0x7b, 0x7d]);
    expect(() => decodeFrame(tooLong)).toThrow(FrameFormatError);
    const overLimit = new Uint8Array(4 + 2000);
    new DataView(overLimit.buffer).setUint32(0, 2000, false);
    expect(() => decodeFrame(overLimit)).toThrow(FrameFormatError);
  });
  it('rejects a header that is not valid JSON and a body that is not a JPEG', () => {
    const badJson = new Uint8Array([0, 0, 0, 2, 0x7b, 0x7b, 0xff, 0xd8]);
    expect(() => decodeFrame(badJson)).toThrow(FrameFormatError);
    const notJpeg = encodeFrame(header, new Uint8Array([0x89, 0x50]));
    expect(() => decodeFrame(notJpeg)).toThrow(FrameFormatError);
  });
  it('reads a frame that is a view inside a larger buffer', () => {
    const message = encodeFrame(header, jpeg);
    const padded = new Uint8Array(message.length + 16).fill(0xee);
    padded.set(message, 8);
    const decoded = decodeFrame(padded.subarray(8, 8 + message.length));
    expect(decoded).toEqual({ header, jpeg });
    expect(decoded.jpeg.buffer).toBe(padded.buffer);
  });
});
