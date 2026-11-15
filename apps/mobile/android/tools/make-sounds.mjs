// Writes the five sounds of the app to app/src/main/res/raw as 16-bit mono WAV files at 44100 Hz.
// Each tone is a sine with a fade of 5 ms at both ends. Run: node tools/make-sounds.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 44100;
const FADE_MS = 5;
const LEVEL = 0.5;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'res', 'raw');

// Each part is [frequency in Hz, length in ms]. The frequency 0 is silence.
const SOUNDS = {
  found: [[660, 90], [880, 120]],
  added: [[880, 110]],
  removed: [[660, 90], [440, 140]],
  warning: [[330, 120], [0, 60], [330, 120], [0, 60], [330, 120]],
  paid: [[523, 90], [659, 90], [784, 220]],
};

function tone(hz, ms) {
  const count = Math.round((RATE * ms) / 1000);
  const fade = Math.round((RATE * FADE_MS) / 1000);
  const samples = new Int16Array(count);
  if (hz === 0) return samples;
  for (let i = 0; i < count; i += 1) {
    const envelope = Math.min(1, i / fade, (count - 1 - i) / fade);
    samples[i] = Math.round(LEVEL * envelope * 32767 * Math.sin((2 * Math.PI * hz * i) / RATE));
  }
  return samples;
}

function wav(parts) {
  const tones = parts.map(([hz, ms]) => tone(hz, ms));
  const sampleCount = tones.reduce((sum, samples) => sum + samples.length, 0);
  const file = Buffer.alloc(44 + sampleCount * 2);
  file.write('RIFF', 0, 'ascii');
  file.writeUInt32LE(36 + sampleCount * 2, 4);
  file.write('WAVEfmt ', 8, 'ascii');
  file.writeUInt32LE(16, 16);
  file.writeUInt16LE(1, 20); // PCM
  file.writeUInt16LE(1, 22); // one channel
  file.writeUInt32LE(RATE, 24);
  file.writeUInt32LE(RATE * 2, 28); // bytes each second
  file.writeUInt16LE(2, 32); // bytes each sample
  file.writeUInt16LE(16, 34); // bits each sample
  file.write('data', 36, 'ascii');
  file.writeUInt32LE(sampleCount * 2, 40);
  let offset = 44;
  for (const samples of tones) {
    for (const sample of samples) {
      file.writeInt16LE(sample, offset);
      offset += 2;
    }
  }
  return { file, ms: Math.round((sampleCount * 1000) / RATE) };
}

mkdirSync(OUT, { recursive: true });
for (const [name, parts] of Object.entries(SOUNDS)) {
  const { file, ms } = wav(parts);
  writeFileSync(join(OUT, `${name}.wav`), file);
  console.log(`${name}.wav ${ms} ms ${file.length} bytes`);
}
