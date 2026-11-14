import { expect, it } from 'vitest';
import { ClipQueue, type PlayClip } from './clipQueue';

type Settle = { resolve(): void; reject(error: Error): void };

const tick = () => new Promise<void>((resolve) => { setTimeout(resolve, 0); });

function fakePlayer() {
  const started: string[] = [];
  const signals: AbortSignal[] = [];
  const open = new Map<string, Settle>();
  const play: PlayClip = (url, signal) => {
    started.push(url);
    signals.push(signal);
    return new Promise<void>((resolve, reject) => { open.set(url, { resolve, reject }); });
  };
  const finish = async (url: string) => { open.get(url)?.resolve(); await tick(); };
  const fail = async (url: string) => { open.get(url)?.reject(new Error(`clip ${url} failed`)); await tick(); };
  return { play, started, signals, finish, fail };
}

it('plays one clip at a time, in arrival order', async () => {
  const player = fakePlayer();
  const queue = new ClipQueue(player.play);
  queue.enqueue('a'); queue.enqueue('b');
  expect(player.started).toEqual(['a']);
  await player.finish('a');
  expect(player.started).toEqual(['a', 'b']);
});
it('goes on after a clip that fails', async () => {
  const player = fakePlayer();
  const queue = new ClipQueue(player.play);
  queue.enqueue('a'); queue.enqueue('b');
  await player.fail('a');
  expect(player.started).toEqual(['a', 'b']);
});
it('goes on after a player that throws', async () => {
  const started: string[] = [];
  const queue = new ClipQueue((url) => {
    started.push(url);
    if (url === 'a') throw new Error('no audio');
    return Promise.resolve();
  });
  queue.enqueue('a'); queue.enqueue('b');
  await tick();
  expect(started).toEqual(['a', 'b']);
});
it('drops the oldest waiting clip when more than 2 wait', async () => {
  const player = fakePlayer();
  const queue = new ClipQueue(player.play);
  for (const url of ['a', 'b', 'c', 'd']) queue.enqueue(url);
  await player.finish('a'); await player.finish('c'); await player.finish('d');
  expect(player.started).toEqual(['a', 'c', 'd']);
});
it('stops the current clip and plays nothing while muted', async () => {
  const player = fakePlayer();
  const queue = new ClipQueue(player.play);
  queue.enqueue('a'); queue.enqueue('b');
  queue.setMuted(true);
  expect(player.signals[0]?.aborted).toBe(true);
  queue.enqueue('c');
  await player.fail('a');
  expect(player.started).toEqual(['a']);
  queue.setMuted(false);
  queue.enqueue('d');
  expect(player.started).toEqual(['a', 'd']);
});
it('stops the current clip and drops the waiting clips on stop', async () => {
  const player = fakePlayer();
  const queue = new ClipQueue(player.play);
  queue.enqueue('a'); queue.enqueue('b');
  queue.stop();
  expect(player.signals[0]?.aborted).toBe(true);
  await player.finish('a');
  expect(player.started).toEqual(['a']);
});
