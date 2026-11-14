import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pickSerial, reverseTarget, testPort } from './device.mjs';

const ONE = 'List of devices attached\n00023156K005488\tdevice\n\n';
const TWO = 'List of devices attached\n00023156K005488\tdevice\nemulator-5554\tdevice\n';
const NONE = 'List of devices attached\n\n';
const NOT_READY = 'List of devices attached\n00023156K005488\tunauthorized\nR58M\toffline\n';

test('the serial of the environment wins, also with two phones attached', () => {
  assert.equal(pickSerial('ABC123', TWO), 'ABC123');
  assert.equal(pickSerial(' ABC123 ', NONE), 'ABC123');
});

test('with no serial in the environment, the one attached phone is the test phone', () => {
  assert.equal(pickSerial(undefined, ONE), '00023156K005488');
  assert.equal(pickSerial('', ONE.replaceAll('\n', '\r\n')), '00023156K005488');
});

test('no phone and a phone that is not ready give a clear message', () => {
  assert.throws(() => pickSerial(undefined, NONE), /No phone is attached/);
  assert.throws(() => pickSerial(undefined, NOT_READY), /No phone is attached/);
});

test('several phones give a message with their serials', () => {
  assert.throws(() => pickSerial(undefined, TWO), /2 phones are attached.*ANDROID_SERIAL.*00023156K005488, emulator-5554/);
});

test('the port of the server is 8080, or the value of GLANCE_TEST_PORT', () => {
  assert.equal(testPort(undefined), 8080);
  assert.equal(testPort(''), 8080);
  assert.equal(testPort('18080'), 18080);
  for (const bad of ['0', '70000', 'abc', '80.5', '-1']) assert.throws(() => testPort(bad), /GLANCE_TEST_PORT/);
});

test('reads the target of a reverse entry of the phone', () => {
  const list = 'UsbFfs tcp:8080 tcp:8081\r\nUsbFfs tcp:8081 tcp:8081\r\n';
  assert.equal(reverseTarget(list, 8080), 'tcp:8081');
  assert.equal(reverseTarget(list, 8081), 'tcp:8081');
  assert.equal(reverseTarget(list, 808), null);
  assert.equal(reverseTarget('', 8080), null);
});
