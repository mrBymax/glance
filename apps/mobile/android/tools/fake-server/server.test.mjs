// Plays one shop against the fake server on 127.0.0.1 and a free port.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { WebSocket } from 'ws';
import { startFakeServer } from './server.mjs';

const WAIT_MS = 2000;
let server;
let base;

before(async () => {
  server = await startFakeServer({ port: 0, host: '127.0.0.1', log: () => {}, firstPromptMs: 0, promptGapMs: 0, dropMs: 300 });
  base = `http://127.0.0.1:${server.port}`;
});

after(() => server.close());

// Opens the device socket. `next()` gives the messages in order, and fails after 2 seconds with none.
async function openDevice() {
  const socket = new WebSocket(`ws://127.0.0.1:${server.port}/ws/device?session=s-1&token=t-1`);
  const received = [];
  const waiting = [];
  socket.on('message', (data) => {
    const message = JSON.parse(data.toString('utf8'));
    const waiter = waiting.shift();
    if (waiter) waiter(message);
    else received.push(message);
  });
  await new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  const next = () =>
    new Promise((resolve, reject) => {
      if (received.length > 0) {
        resolve(received.shift());
        return;
      }
      const timer = setTimeout(() => reject(new Error('No message arrived in 2 seconds.')), WAIT_MS);
      waiting.push((message) => {
        clearTimeout(timer);
        resolve(message);
      });
    });
  const sendJson = (message) => socket.send(JSON.stringify(message));
  const sendFrame = (seq, kind) => {
    const header = Buffer.from(JSON.stringify({ seq, ts: Date.now(), w: 432, h: 768, blurred: false, ...(kind ? { kind } : {}) }), 'utf8');
    const length = Buffer.alloc(4);
    length.writeUInt32BE(header.length, 0);
    socket.send(Buffer.concat([length, header, Buffer.from([0xff, 0xd8, 0xff, 0xd9])]));
  };
  return { socket, next, sendJson, sendFrame };
}

const deviceState = (stream) => ({ t: 'device.state', state: { link: 'connected', battery: 80, worn: true, hingeOpen: true, thermal: 0, stream } });

test('answers the REST calls of the app', async () => {
  const created = await (await fetch(`${base}/api/sessions`, { method: 'POST', body: '{}' })).json();
  assert.deepEqual(created, { sessionId: 's-1', token: 't-1', wsUrl: `ws://localhost:${server.port}/ws/device?session=s-1&token=t-1` });

  const snapshot = await (await fetch(`${base}/api/sessions/s-1?token=t-1`)).json();
  assert.equal(snapshot.sessionId, 's-1');
  assert.equal(snapshot.phase, 'shopping');

  assert.equal((await fetch(`${base}/api/sessions/s-1?token=t-1`, { method: 'DELETE' })).status, 204);
  assert.equal((await fetch(`${base}/missing.mp3`)).status, 404);

  const clip = await fetch(`${base}/clip.wav`);
  const bytes = Buffer.from(await clip.arrayBuffer());
  assert.equal(clip.headers.get('content-type'), 'audio/wav');
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.length, 44 + 22050 * 2);
});

test('plays one shop from the first frame to the paid line', async () => {
  await fetch(`${base}/api/sessions`, { method: 'POST', body: '{}' });
  const device = await openDevice();
  try {
    assert.equal((await device.next()).t, 'snapshot');

    device.sendJson(deviceState('streaming'));
    const cameraOn = await device.next();
    assert.equal(cameraOn.text, 'Camera on. Hold a product up to hear its price.');
    assert.equal(cameraOn.url, '/clip.wav');

    device.sendFrame(1);
    const pending = await device.next();
    assert.equal(pending.event.type, 'glance.pending');
    const productPrompt = await device.next();
    assert.equal(productPrompt.t, 'speak');
    assert.equal(productPrompt.promptId, pending.event.promptId);
    assert.equal(productPrompt.sound, 'found');

    device.sendJson({ t: 'prompt.done', promptId: productPrompt.promptId });
    device.sendJson({ t: 'intent', kind: 'yes', source: 'head', promptId: 'p-9999' });
    device.sendJson({ t: 'intent', kind: 'yes', source: 'head', promptId: productPrompt.promptId });
    assert.deepEqual((await device.next()).event, { type: 'glance.cleared', promptId: productPrompt.promptId });
    const added = await device.next();
    assert.equal(added.sound, 'added');
    assert.equal(added.promptId, null);
    assert.equal((await device.next()).event.type, 'cart.updated');

    device.sendJson({ t: 'kiosk.seen', text: 'GL1 K3X7' });
    const offered = await device.next();
    assert.equal(offered.event.type, 'checkout.offered');
    const payPrompt = await device.next();
    assert.equal(payPrompt.promptId, offered.event.promptId);
    assert.notEqual(payPrompt.promptId, productPrompt.promptId);

    device.sendJson({ t: 'intent', kind: 'yes', source: 'head', promptId: payPrompt.promptId });
    assert.equal((await device.next()).event.type, 'checkout.paid');
    assert.equal((await device.next()).sound, 'paid');
    assert.equal((await device.next()).t, 'session.end');
  } finally {
    device.socket.terminate();
  }
});

test('skips a product, replaces a prompt that got no answer, and runs the keyboard commands', async () => {
  await fetch(`${base}/api/sessions`, { method: 'POST', body: '{}' });
  const device = await openDevice();
  try {
    await device.next();
    device.sendFrame(1);
    const first = (await device.next()).event.promptId;
    await device.next();
    device.sendJson({ t: 'intent', kind: 'no', source: 'phone', promptId: first });
    assert.deepEqual((await device.next()).event, { type: 'glance.cleared', promptId: first });
    assert.equal((await device.next()).text, 'Skipped.');

    device.sendFrame(2);
    const second = (await device.next()).event.promptId;
    await device.next();
    device.sendFrame(3);
    assert.deepEqual((await device.next()).event, { type: 'glance.cleared', promptId: second });
    assert.equal((await device.next()).event.type, 'glance.pending');
    await device.next();

    server.command('badclip');
    assert.equal((await device.next()).event.type, 'glance.cleared');
    assert.equal((await device.next()).event.type, 'glance.pending');
    assert.equal((await device.next()).url, '/missing.mp3');
    server.command('amb');
    assert.equal((await device.next()).event.type, 'glance.ambiguous');
    server.command('bio');
    assert.equal((await device.next()).t, 'biometric.request');
    server.command('rest');
    assert.equal((await device.next()).t, 'session.rest');
    server.command('cancel');
    assert.deepEqual((await device.next()).event, { type: 'checkout.cancelled' });
    server.command('slow');
    assert.deepEqual((await device.next()).event, { type: 'error', code: 'recognition.slow', message: 'Recognition is slow right now.' });
    assert.equal((await device.next()).text, 'Recognition is slow right now.');

    device.sendJson({ t: 'intent', kind: 'stop', source: 'phone' });
    assert.equal((await device.next()).text, 'Camera off.');
    assert.equal((await device.next()).t, 'session.end');
  } finally {
    device.socket.terminate();
  }
});

test('drop closes the socket and refuses a new one for the drop time', async () => {
  const device = await openDevice();
  const closed = new Promise((resolve) => device.socket.once('close', resolve));
  server.command('drop');
  await closed;
  await assert.rejects(openDevice());
  await new Promise((resolve) => setTimeout(resolve, 400));
  const again = await openDevice();
  assert.equal((await again.next()).t, 'snapshot');
  again.socket.terminate();
});

test('a test on the phone runs a command and reads the log through HTTP', async () => {
  const device = await openDevice();
  try {
    await device.next();
    assert.equal((await fetch(`${base}/debug/command/bio`, { method: 'POST' })).status, 204);
    assert.equal((await device.next()).t, 'biometric.request');
    device.sendJson({ t: 'biometric.result', ok: true });
    device.sendFrame(1, 'still');
    // The answer to a later message shows that the server read the two messages before it.
    device.sendJson(deviceState('streaming'));
    await device.next();

    const lines = await (await fetch(`${base}/debug/log`)).json();
    assert.ok(lines.includes('command bio'));
    assert.ok(lines.includes('biometric.result ok=true'));
    assert.ok(lines.some((line) => /^frame seq=1 .* kind=still /.test(line)));
    assert.equal((await fetch(`${base}/debug/command/nothing`, { method: 'POST' })).status, 404);
  } finally {
    device.socket.terminate();
  }
});

test('logs barcode.seen and the kind of a label frame, and the command label asks for a still', async () => {
  const device = await openDevice();
  try {
    await device.next();
    assert.equal(server.command('label'), true);
    assert.deepEqual(await device.next(), { t: 'still.request', purpose: 'label' });

    device.sendJson({ t: 'barcode.seen', code: '4006381333931', source: 'barcode' });
    device.sendJson({ t: 'barcode.seen', code: '8076809513753', source: 'ocr' });
    device.sendFrame(7, 'label');
    device.sendFrame(8);
    // The answer to a later message shows that the server read the messages before it.
    device.sendJson(deviceState('streaming'));
    await device.next();

    const lines = await (await fetch(`${base}/debug/log`)).json();
    assert.ok(lines.includes('command label'));
    assert.ok(lines.includes('barcode.seen 4006381333931 source=barcode'));
    assert.ok(lines.includes('barcode.seen 8076809513753 source=ocr'));
    assert.ok(lines.some((line) => /^frame seq=7 .* kind=label /.test(line)));
    assert.ok(lines.some((line) => /^frame seq=8 .* kind=frame /.test(line)));
  } finally {
    device.socket.terminate();
  }
});
