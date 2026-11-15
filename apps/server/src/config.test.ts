import { expect, it } from 'vitest';
import { ConfigError, loadConfig } from './config';

const KEYS = { GEMINI_API_KEY: 'g', ELEVENLABS_API_KEY: 'e', ELEVENLABS_VOICE_EN: 'v' };

it('uses the defaults', () => {
  expect(loadConfig(KEYS, [])).toMatchObject({
    port: 8080, publicBaseUrl: 'http://localhost:8080', mongodbUri: null, mongodbDb: 'glance',
    catalogPath: 'catalog/catalog.dev.json', geminiModel: 'gemini-3.5-flash-lite',
    geminiMediaResolution: 'default', minConfidence: 0.6, labelMinConfidence: 0.7, requireBlur: false, fakeRecognition: null, fakeSpeech: false,
    speechCacheDir: '.cache/speech', saveFramesDir: null, paymentDelayMs: 1500, secondLookWaitMs: 0, biometricAboveCents: null,
    storeListPath: 'catalog/store-list.dev.json', fakeProductInfo: false, offBaseUrl: 'https://world.openfoodfacts.org',
    productInfoUserAgent: 'MetaGlance/0.1 (https://github.com/mrBymax/glance)', productCacheDir: '.cache/products',
    referenceDir: 'catalog/reference', recognitionConcurrency: 8, recognitionReferences: 3,
    recognitionPipeline: 'frame', verifyMinConfidence: 0.9, speechWarmUp: true,
  });
  expect(loadConfig({ ...KEYS, SPEECH_WARM_UP: '0' }, []).speechWarmUp).toBe(false);
  expect(loadConfig({ ...KEYS, REFERENCE_DIR: '/data/reference' }, []).referenceDir).toBe('/data/reference');
});
it('reads the demo key, and an empty value counts as not set', () => {
  expect(loadConfig(KEYS, []).demoKey).toBeNull();
  expect(loadConfig({ ...KEYS, DEMO_KEY: '' }, []).demoKey).toBeNull();
  expect(loadConfig({ ...KEYS, DEMO_KEY: 'k-demo' }, []).demoKey).toBe('k-demo');
});
it('has the paths under /api/store on, and STORE_EDIT=0 turns them off', () => {
  expect(loadConfig(KEYS, []).storeEdit).toBe(true);
  expect(loadConfig({ ...KEYS, STORE_EDIT: '1' }, []).storeEdit).toBe(true);
  expect(loadConfig({ ...KEYS, STORE_EDIT: '0' }, []).storeEdit).toBe(false);
});
it('needs no key in fake mode', () => {
  expect(loadConfig({}, ['--fake'])).toMatchObject({
    fakeRecognition: 'fixtures/fake-script.json', fakeSpeech: true, fakeProductInfo: true, geminiApiKey: null, elevenlabsApiKey: null,
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
  expect(config).toMatchObject({ fakeRecognition: 'my.json', fakeSpeech: false, fakeProductInfo: true });
  expect(loadConfig({ FAKE_PRODUCT_INFO: '0' }, ['--fake']).fakeProductInfo).toBe(false);
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
it('reads the confidence that the item of a label needs', () => {
  expect(loadConfig({ LABEL_MIN_CONFIDENCE: '0.85' }, ['--fake']).labelMinConfidence).toBe(0.85);
  expect(() => loadConfig({ LABEL_MIN_CONFIDENCE: '1.1' }, ['--fake'])).toThrow(/LABEL_MIN_CONFIDENCE/);
});
it('reads the wait for the sharp second look, which is off at 0', () => {
  expect(loadConfig({}, ['--fake']).secondLookWaitMs).toBe(0);
  expect(loadConfig({ SECOND_LOOK_WAIT_MS: '2500' }, ['--fake']).secondLookWaitMs).toBe(2500);
  expect(() => loadConfig({ SECOND_LOOK_WAIT_MS: '-1' }, ['--fake'])).toThrow(/SECOND_LOOK_WAIT_MS/);
  expect(() => loadConfig({ SECOND_LOOK_WAIT_MS: '2.5' }, ['--fake'])).toThrow(/SECOND_LOOK_WAIT_MS/);
  expect(() => loadConfig({ SECOND_LOOK_WAIT_MS: '10001' }, ['--fake'])).toThrow(/SECOND_LOOK_WAIT_MS/);
});
it('reads the total above which a payment needs a fingerprint, and has no limit when it is not set', () => {
  expect(loadConfig({}, ['--fake']).biometricAboveCents).toBeNull();
  expect(loadConfig({ BIOMETRIC_ABOVE_CENTS: '' }, ['--fake']).biometricAboveCents).toBeNull();
  expect(loadConfig({ BIOMETRIC_ABOVE_CENTS: '5000' }, ['--fake']).biometricAboveCents).toBe(5000);
  expect(loadConfig({ BIOMETRIC_ABOVE_CENTS: '0' }, ['--fake']).biometricAboveCents).toBe(0);
  expect(() => loadConfig({ BIOMETRIC_ABOVE_CENTS: '-1' }, ['--fake'])).toThrow(ConfigError);
  expect(() => loadConfig({ BIOMETRIC_ABOVE_CENTS: '49.5' }, ['--fake'])).toThrow(/BIOMETRIC_ABOVE_CENTS/);
  expect(() => loadConfig({ BIOMETRIC_ABOVE_CENTS: 'fifty' }, ['--fake'])).toThrow(/BIOMETRIC_ABOVE_CENTS/);
  expect(() => loadConfig({ BIOMETRIC_ABOVE_CENTS: '100000001' }, ['--fake'])).toThrow(/BIOMETRIC_ABOVE_CENTS/);
});
it('reads the number of recognition calls that run at the same time, from 1 to 12', () => {
  expect(loadConfig({ RECOGNITION_CONCURRENCY: '1' }, ['--fake']).recognitionConcurrency).toBe(1);
  expect(loadConfig({ RECOGNITION_CONCURRENCY: '12' }, ['--fake']).recognitionConcurrency).toBe(12);
  expect(() => loadConfig({ RECOGNITION_CONCURRENCY: '0' }, ['--fake'])).toThrow(/RECOGNITION_CONCURRENCY/);
  expect(() => loadConfig({ RECOGNITION_CONCURRENCY: '13' }, ['--fake'])).toThrow(/RECOGNITION_CONCURRENCY/);
  expect(() => loadConfig({ RECOGNITION_CONCURRENCY: '1.5' }, ['--fake'])).toThrow(/RECOGNITION_CONCURRENCY/);
});
it('reads the number of reference pictures of one item in a frame call, from 0 to 3', () => {
  expect(loadConfig({ RECOGNITION_REFERENCES: '0' }, ['--fake']).recognitionReferences).toBe(0);
  expect(loadConfig({ RECOGNITION_REFERENCES: '1' }, ['--fake']).recognitionReferences).toBe(1);
  expect(() => loadConfig({ RECOGNITION_REFERENCES: '4' }, ['--fake'])).toThrow(/RECOGNITION_REFERENCES/);
  expect(() => loadConfig({ RECOGNITION_REFERENCES: '-1' }, ['--fake'])).toThrow(/RECOGNITION_REFERENCES/);
  expect(() => loadConfig({ RECOGNITION_REFERENCES: '1.5' }, ['--fake'])).toThrow(/RECOGNITION_REFERENCES/);
});
it('reads the settings of the barcode lookup', () => {
  const config = loadConfig({
    ...KEYS, STORE_LIST_PATH: 'my-list.json', FAKE_PRODUCT_INFO: '1', OFF_BASE_URL: 'https://world.openfoodfacts.net',
    PRODUCT_INFO_USER_AGENT: 'Shop/2 (shop@example.com)', PRODUCT_CACHE_DIR: '/data/products',
  }, []);
  expect(config).toMatchObject({
    storeListPath: 'my-list.json', fakeProductInfo: true, offBaseUrl: 'https://world.openfoodfacts.net',
    productInfoUserAgent: 'Shop/2 (shop@example.com)', productCacheDir: '/data/products',
  });
});
it('needs no key for the product details, and rejects a base address that is no web address', () => {
  expect(loadConfig(KEYS, []).fakeProductInfo).toBe(false);
  expect(() => loadConfig({ OFF_BASE_URL: 'world.openfoodfacts.org' }, ['--fake'])).toThrow(/OFF_BASE_URL/);
});
it('reads the recognition pipeline, and stops for a name that it does not know', () => {
  expect(loadConfig({ RECOGNITION_PIPELINE: 'observe' }, ['--fake']).recognitionPipeline).toBe('observe');
  expect(loadConfig({ RECOGNITION_PIPELINE: 'frame' }, ['--fake']).recognitionPipeline).toBe('frame');
  expect(loadConfig({ RECOGNITION_PIPELINE: '' }, ['--fake']).recognitionPipeline).toBe('frame');
  expect(() => loadConfig({ RECOGNITION_PIPELINE: 'live' }, ['--fake'])).toThrow('RECOGNITION_PIPELINE must be "frame" or "observe". Got "live".');
});
it('reads the confidence of the verify call', () => {
  expect(loadConfig({ VERIFY_MIN_CONFIDENCE: '0.95' }, ['--fake']).verifyMinConfidence).toBe(0.95);
  expect(() => loadConfig({ VERIFY_MIN_CONFIDENCE: '2' }, ['--fake'])).toThrow(/VERIFY_MIN_CONFIDENCE/);
});
