export type Config = {
  port: number;
  publicBaseUrl: string;
  /** null selects the memory store. */
  mongodbUri: string | null;
  mongodbDb: string;
  catalogPath: string;
  geminiApiKey: string | null;
  geminiModel: string;
  geminiMediaResolution: 'default' | 'low';
  minConfidence: number;
  /** Drop each frame that the phone sent with blurred: false. */
  requireBlur: boolean;
  /** The path of the script file, or null when recognition is real. */
  fakeRecognition: string | null;
  fakeSpeech: boolean;
  elevenlabsApiKey: string | null;
  voiceId: { en: string | null; it: string | null };
  speechCacheDir: string;
  /** A directory for frames, or null. The server stores no frame without it. */
  saveFramesDir: string | null;
  paymentDelayMs: number;
  /** The key of GET /api/demo/latest, or null. Without it that path answers 404. */
  demoKey: string | null;
};

export class ConfigError extends Error {}

const DEFAULT_FAKE_SCRIPT = 'fixtures/fake-script.json';
/** The catalog file when CATALOG_PATH is not set. */
export const DEFAULT_CATALOG_PATH = 'catalog/catalog.dev.json';

/**
 * Reads the settings from the environment and the command line.
 * The flag --fake turns both fake switches on. A variable that is set wins over the flag.
 * Paths are relative to the working directory, which is apps/server.
 */
export function loadConfig(env: Record<string, string | undefined>, argv: readonly string[]): Config {
  const read = (name: string): string | null => {
    const value = env[name];
    return value === undefined || value === '' ? null : value;
  };
  const readNumber = (name: string, fallback: number, min: number, max: number, integer: boolean): number => {
    const text = read(name);
    if (text === null) return fallback;
    const value = Number(text);
    if (!Number.isFinite(value) || (integer && !Number.isInteger(value))) {
      throw new ConfigError(`${name} must be ${integer ? 'an integer' : 'a number'}. Got "${text}".`);
    }
    if (value < min || value > max) {
      throw new ConfigError(`${name} must be from ${min} to ${max}. Got "${text}".`);
    }
    return value;
  };

  const fakeFlag = argv.includes('--fake');
  const fakeRecognitionValue = read('FAKE_RECOGNITION') ?? (fakeFlag ? '1' : null);
  const fakeRecognition = fakeRecognitionValue === '1' ? DEFAULT_FAKE_SCRIPT : fakeRecognitionValue;
  const fakeSpeechValue = read('FAKE_SPEECH');
  const fakeSpeech = fakeSpeechValue === null ? fakeFlag : fakeSpeechValue === '1';

  const mediaResolution = read('GEMINI_MEDIA_RESOLUTION') ?? 'default';
  if (mediaResolution !== 'default' && mediaResolution !== 'low') {
    throw new ConfigError(`GEMINI_MEDIA_RESOLUTION must be "default" or "low". Got "${mediaResolution}".`);
  }

  const port = readNumber('PORT', 8080, 0, 65535, true);
  const config: Config = {
    port,
    publicBaseUrl: read('PUBLIC_BASE_URL') ?? `http://localhost:${port}`,
    mongodbUri: read('MONGODB_URI'),
    mongodbDb: read('MONGODB_DB') ?? 'glance',
    catalogPath: read('CATALOG_PATH') ?? DEFAULT_CATALOG_PATH,
    geminiApiKey: read('GEMINI_API_KEY'),
    geminiModel: read('GEMINI_MODEL') ?? 'gemini-3.5-flash-lite',
    geminiMediaResolution: mediaResolution,
    minConfidence: readNumber('RECOGNITION_MIN_CONFIDENCE', 0.6, 0, 1, false),
    requireBlur: read('REQUIRE_BLUR') === '1',
    fakeRecognition,
    fakeSpeech,
    elevenlabsApiKey: read('ELEVENLABS_API_KEY'),
    voiceId: { en: read('ELEVENLABS_VOICE_EN'), it: read('ELEVENLABS_VOICE_IT') },
    speechCacheDir: read('SPEECH_CACHE_DIR') ?? '.cache/speech',
    saveFramesDir: read('SAVE_FRAMES'),
    paymentDelayMs: readNumber('PAYMENT_DELAY_MS', 1500, 0, 600_000, true),
    demoKey: read('DEMO_KEY'),
  };

  if (config.fakeRecognition === null && config.geminiApiKey === null) {
    throw new ConfigError('GEMINI_API_KEY is not set. Set it, or set FAKE_RECOGNITION=1 to run with no recognition service.');
  }
  if (!config.fakeSpeech) {
    for (const [name, value] of [['ELEVENLABS_API_KEY', config.elevenlabsApiKey], ['ELEVENLABS_VOICE_EN', config.voiceId.en]] as const) {
      if (value === null) {
        throw new ConfigError(`${name} is not set. Set it, or set FAKE_SPEECH=1 to run with no speech service.`);
      }
    }
  }
  return config;
}
