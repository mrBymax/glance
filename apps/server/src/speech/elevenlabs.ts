// The call of https://elevenlabs.io/docs/api-reference/text-to-speech/stream

export const ELEVENLABS_MODEL = 'eleven_flash_v2_5';
export const ELEVENLABS_FORMAT = 'mp3_44100_128';
/** A line waits for its clip. After this time it goes out with no clip, and the phone reads the text. */
export const ELEVENLABS_TIMEOUT_MS = 3000;

const BASE_URL = 'https://api.elevenlabs.io';
const LOGGED_BODY_CHARS = 200;

/** Returns the MP3 of a text. Rejects with an error that holds the HTTP status. */
export type Synthesize = (text: string, voiceId: string) => Promise<Uint8Array>;
export type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

/** `fetchFn` takes the place of the global fetch in a test. */
export function createSynthesize(apiKey: string, fetchFn: FetchFn = fetch): Synthesize {
  return async (text, voiceId) => {
    const url = `${BASE_URL}/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=${ELEVENLABS_FORMAT}`;
    const response = await fetchFn(url, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({ text, model_id: ELEVENLABS_MODEL }),
      signal: AbortSignal.timeout(ELEVENLABS_TIMEOUT_MS),
    });
    if (response.status !== 200) {
      // The body names the cause, for example a quota that is used up. It never holds the key.
      const body = (await response.text().catch(() => '')).slice(0, LOGGED_BODY_CHARS);
      throw new Error(`ElevenLabs answered ${response.status}. ${body}`.trim());
    }
    const mp3 = new Uint8Array(await response.arrayBuffer());
    if (mp3.length === 0) throw new Error('ElevenLabs answered 200 with no audio.');
    return mp3;
  };
}
