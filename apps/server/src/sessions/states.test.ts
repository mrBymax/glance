import { expect, it } from 'vitest';
import { ServerEventSchema } from '@glance/shared';
import { OAT, RYE, STREAMING, harness } from './harness';

it('says Paused one time when the stream pauses', () => {
  const h = harness();
  h.send({ type: 'device.state', state: STREAMING });
  h.send({ type: 'device.state', state: { ...STREAMING, stream: 'paused' } });
  expect(h.lines()).toEqual(['device.paused']);
  expect(h.speak()).toMatchObject({ priority: 'high', interrupt: true, promptId: null });
  h.send({ type: 'device.state', state: { ...STREAMING, stream: 'paused', battery: 79 } });
  expect(h.effects).toEqual([]);
  h.send({ type: 'device.state', state: STREAMING });
  expect(h.effects).toEqual([]);
  expect(h.state.cameraOn).toBe(true);
  h.send({ type: 'device.state', state: { ...STREAMING, stream: 'paused' } });
  expect(h.lines()).toEqual(['device.paused']);
});
it('a pause keeps the cart and the phase', () => {
  const h = harness({ cart: [RYE] });
  h.send({ type: 'device.state', state: STREAMING });
  h.send({ type: 'device.state', state: { ...STREAMING, stream: 'paused' } });
  expect(h.events()).toEqual([]);
  expect(h.state).toMatchObject({ phase: 'shopping', cameraOn: true, cart: { totalCents: 260 } });
});
it('reports the battery at 20 and at 10 percent, one time each', () => {
  const h = harness();
  h.send({ type: 'device.state', state: STREAMING });
  const level = (battery: number) => {
    h.send({ type: 'device.state', state: { ...STREAMING, battery } });
    return h.speak()?.line;
  };
  expect(level(21)).toBeUndefined();
  expect(level(20)).toEqual({ key: 'device.battery', percent: 20 });
  expect(level(19)).toBeUndefined();
  expect(level(10)).toEqual({ key: 'device.battery', percent: 10 });
  expect(level(9)).toBeUndefined();
  expect(level(80)).toBeUndefined();
  expect(level(8)).toEqual({ key: 'device.battery', percent: 10 });
  // The battery went from 8 to 15 on the charger: 15 is no new warning.
  expect(level(15)).toBeUndefined();
});
it('reports a low battery after Camera on when the first state holds it', () => {
  const h = harness();
  h.send({ type: 'device.state', state: { ...STREAMING, battery: 18 } });
  expect(h.lines()).toEqual(['session.start', 'device.battery']);
  expect(h.state.batteryWarned).toBe(20);
});
it('gives no battery line with a stopped stream or with no battery value', () => {
  const h = harness();
  h.send({ type: 'device.state', state: STREAMING });
  h.send({ type: 'device.state', state: { ...STREAMING, battery: null } });
  expect(h.effects).toEqual([]);
  h.send({ type: 'device.state', state: { ...STREAMING, stream: 'stopped', battery: 15 } });
  expect(h.lines()).toEqual(['device.cameraOff']);
  h.send({ type: 'device.state', state: { ...STREAMING, stream: 'stopped', battery: 14 } });
  expect(h.effects).toEqual([]);
  expect(h.state.batteryWarned).toBeNull();
  // The warning comes when the camera is on again.
  h.send({ type: 'device.state', state: { ...STREAMING, battery: 14 } });
  expect(h.lines()).toEqual(['session.start', 'device.battery']);
});
it('reports slow recognition with a line and an error event', () => {
  const h = harness();
  h.send({ type: 'recognition.slow' });
  expect(h.lines()).toEqual(['recognition.slow']);
  expect(h.speak()).toMatchObject({ priority: 'high', interrupt: false });
  expect(h.event('error')).toEqual({ type: 'error', code: 'recognition.slow', message: 'Recognition is slow right now.' });
  expect(ServerEventSchema.safeParse(h.event('error')).success).toBe(true);
});
it('slow recognition keeps the current prompt', () => {
  const h = harness();
  h.see(OAT);
  const prompt = h.state.prompt;
  expect(prompt).not.toBeNull();
  h.advance(3000);
  h.send({ type: 'recognition.slow' });
  expect(h.state.prompt).toEqual(prompt);
  expect(h.speak()!.promptId).toBeNull();
});
it('says Back online when the socket opens again', () => {
  const h = harness();
  h.send({ type: 'socket.open' });
  expect(h.effects).toEqual([]);
  h.send({ type: 'device.state', state: STREAMING });
  h.send({ type: 'socket.open' });
  expect(h.lines()).toEqual(['net.backOnline']);
  expect(h.speak()).toMatchObject({ priority: 'high', interrupt: false });
});
it('a session that ended gives no line for a new socket or for slow recognition', () => {
  const h = harness();
  h.send({ type: 'device.state', state: STREAMING });
  h.intent('stop');
  h.send({ type: 'socket.open' });
  expect(h.effects).toEqual([]);
  h.send({ type: 'recognition.slow' });
  expect(h.effects).toEqual([]);
});
it('a busy kiosk also sends an error event', () => {
  const h = harness({ cart: [RYE] });
  h.kiosk({ busy: true });
  expect(h.event('error')).toEqual({ type: 'error', code: 'kiosk.busy', message: 'This checkout is busy.' });
  expect(h.lines()).toEqual(['checkout.busy']);
  // One line and one event for each appearance of the code.
  h.advance(1000); h.kiosk({ busy: true });
  expect(h.effects).toEqual([]);
});
it('an empty cart at a free kiosk sends no error event', () => {
  const h = harness();
  h.kiosk();
  expect(h.lines()).toEqual(['checkout.empty']);
  expect(h.event('error')).toBeUndefined();
});
