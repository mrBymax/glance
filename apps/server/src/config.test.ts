import { expect, it } from 'vitest';
import { ConfigError, loadConfig } from './config';

const KEYS = { GEMINI_API_KEY: 'g', ELEVENLABS_API_KEY: 'e', ELEVENLABS_VOICE_EN: 'v' };

it('uses the defaults', () => {
  expect(loadConfig(KEYS, [])).toMatchObject({
    port: 8080, publicBaseUrl: 'http://localhost:8080', mongodbUri: null, mongodbDb: 'glance',
    catalogPath: 'catalog/catalog.dev.json', geminiModel: 'gemini-3.5-flash-lite',
    geminiMediaResolution: 'default', minConfidence: 0.6, requireBlur: false, fakeRecognition: null, fakeSpeech: false,
    speechCacheDir: '.cache/speech', saveFramesDir: null, paymentDelayMs: 1500,
  });
});
it('reads the demo key, and an empty value counts as not set', () => {
  expect(loadConfig(KEYS, []).demoKey).toBeNull();
  expect(loadConfig({ ...KEYS, DEMO_KEY: '' }, []).demoKey).toBeNull();
  expect(loadConfig({ ...KEYS, DEMO_KEY: 'k-demo' }, []).demoKey).toBe('k-demo');
});
it('needs no key in fake mode', () => {
  expect(loadConfig({}, ['--fake'])).toMatchObject({
    fakeRecognition: 'fixtures/fake-script.json', fakeSpeech: true, geminiApiKey: null, elevenlabsApiKey: null,
  });
  expect(loadConfig({ FAKE_RECOGNITION: 'my.json', FAKE_SPEECH: '1' }, []).fakeRecognition).toBe('my.json');
});
it('names the missing variable', () => {
  expect(() => loadConfig({ FAKE_SPEECH: '1' }, [])).toThrow(/GEMINI_API_KEY/);
  expect(() => loadConfig({ FAKE_RECOGNITION: '1' }, [])).toThrow(/ELEVENLABS_API_KEY/);
  expect(() => loadConfig({ FAKE_RECOGNITION: '1', ELEVENLABS_API_KEY: 'e' }, [])).toThrow(/ELEVENLABS_VOICE_EN/);
});
it('turns the blur check on with REQUIRE_BLUR=1 alone', () => {
  expect(loadConfig({ REQUIRE_BLUR: '1' }, ['--fake']).requireBlur).toBe(true);
  expect(loadConfig({ REQUIRE_BLUR: 'true' }, ['--fake']).requireBlur).toBe(false);
  expect(loadConfig({ REQUIRE_BLUR: '' }, ['--fake']).requireBlur).toBe(false);
});
it('rejects a value that is not a number', () => {
  expect(() => loadConfig({ PORT: 'abc' }, ['--fake'])).toThrow(ConfigError);
});
it('lets a variable that is set win over the flag', () => {
  const config = loadConfig({ FAKE_RECOGNITION: 'my.json', FAKE_SPEECH: '0', ...KEYS }, ['--fake']);
  expect(config).toMatchObject({ fakeRecognition: 'my.json', fakeSpeech: false });
});
it('counts an empty value as not set', () => {
  expect(loadConfig({ PORT: '', MONGODB_URI: '', FAKE_RECOGNITION: '' }, ['--fake'])).toMatchObject({
    port: 8080, mongodbUri: null, fakeRecognition: 'fixtures/fake-script.json',
  });
});
it('builds the public address from the port', () => {
  expect(loadConfig({ PORT: '9000' }, ['--fake']).publicBaseUrl).toBe('http://localhost:9000');
  expect(loadConfig({ PUBLIC_BASE_URL: 'https://glance.example' }, ['--fake']).publicBaseUrl).toBe('https://glance.example');
});
it('rejects a value outside its range', () => {
  expect(() => loadConfig({ RECOGNITION_MIN_CONFIDENCE: '1.5' }, ['--fake'])).toThrow(/RECOGNITION_MIN_CONFIDENCE/);
  expect(() => loadConfig({ GEMINI_MEDIA_RESOLUTION: 'high' }, ['--fake'])).toThrow(/GEMINI_MEDIA_RESOLUTION/);
  expect(() => loadConfig({ PORT: '70000' }, ['--fake'])).toThrow(/PORT/);
});
