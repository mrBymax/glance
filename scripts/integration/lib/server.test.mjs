import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { fakeServerEnv, inFakeMode } from './server.mjs';

test('removes each server variable of the shell, and keeps the other variables', () => {
  const shell = {
    PATH: '/bin', GEMINI_API_KEY: 'key', ELEVENLABS_API_KEY: 'key', MONGODB_URI: 'mongodb://shop', SECOND_LOOK_WAIT_MS: '900',
    FAKE_PRODUCT_INFO: '0', OFF_BASE_URL: 'https://world.openfoodfacts.org', PRODUCT_CACHE_DIR: '/cache',
    PRODUCT_INFO_USER_AGENT: 'Shop/1', STORE_LIST_PATH: '/shop/list.json', LABEL_MIN_CONFIDENCE: '0.9', REFERENCE_DIR: '/shop/pictures',
    STORE_EDIT: '0',
  };
  assert.deepEqual(fakeServerEnv(shell, { port: 18123, fakeScript: null, paymentDelayMs: 300, demoKey: null }), {
    PATH: '/bin', PORT: '18123', FAKE_RECOGNITION: '1', FAKE_SPEECH: '1', FAKE_PRODUCT_INFO: '1', PAYMENT_DELAY_MS: '300',
  });
  assert.equal(shell.GEMINI_API_KEY, 'key');
});

test('sets the script file and the demo key of the caller', () => {
  const env = fakeServerEnv({}, { port: 18123, fakeScript: '/tests/script.json', paymentDelayMs: 0, demoKey: 'demo' });
  assert.equal(env.FAKE_RECOGNITION, '/tests/script.json');
  assert.equal(env.DEMO_KEY, 'demo');
  assert.equal(env.PAYMENT_DELAY_MS, '0');
});

test('gives the server the store list and the reference folder of the test', () => {
  const env = fakeServerEnv({ STORE_LIST_PATH: '/shop/list.json' }, { port: 18123, fakeScript: null, paymentDelayMs: 300, demoKey: null, storeDir: '/tmp/test-store' });
  assert.equal(env.STORE_LIST_PATH, join('/tmp/test-store', 'store-list.json'));
  assert.equal(env.REFERENCE_DIR, join('/tmp/test-store', 'reference'));
});

test('a server is in fake mode only when /healthz reports each of the three fake switches', () => {
  assert.equal(inFakeMode({ fakeRecognition: true, fakeSpeech: true, fakeProductInfo: true }), true);
  assert.equal(inFakeMode({ fakeRecognition: true, fakeSpeech: true, fakeProductInfo: false }), false);
  assert.equal(inFakeMode({ fakeRecognition: true, fakeSpeech: true }), false);
  assert.equal(inFakeMode({ fakeRecognition: false, fakeSpeech: true, fakeProductInfo: true }), false);
  assert.equal(inFakeMode({ fakeRecognition: true, fakeSpeech: false, fakeProductInfo: true }), false);
});
