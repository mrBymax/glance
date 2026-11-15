/** Plays one clip. The promise resolves when the clip ends, and the player stops the clip when `signal` aborts. */
export type PlayClip = (url: string, signal: AbortSignal) => Promise<void>;

export const MAX_WAITING_CLIPS = 2;

/** Plays speech clips one at a time, in arrival order. */
export class ClipQueue {
  private readonly play: PlayClip;
  private waiting: string[] = [];
  private current: AbortController | null = null;
  private isMuted = false;

  constructor(play: PlayClip) {
    this.play = play;
  }

  enqueue(url: string): void {
    if (this.isMuted) return;
    this.waiting.push(url);
    // The voice of the glasses does not wait for the mirror. An old clip goes, so that the mirror stays near the voice.
    if (this.waiting.length > MAX_WAITING_CLIPS) this.waiting.shift();
    this.playNext();
  }

  /** With `true`: stops the current clip, drops the waiting clips, and ignores new ones. */
  setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (muted) this.stop();
  }

  stop(): void {
    this.waiting = [];
    this.current?.abort();
    this.current = null;
  }

  private playNext(): void {
    if (this.current) return;
    const url = this.waiting.shift();
    if (url === undefined) return;
    const controller = new AbortController();
    this.current = controller;
    const done = () => {
      // After a stop, the clip that ended is not the current one, and it must not start the next clip.
      if (this.current !== controller) return;
      this.current = null;
      this.playNext();
    };
    // A clip that fails must not stop the queue: a missing file, or a browser that blocks sound.
    let playing: Promise<void>;
    try {
      playing = this.play(url, controller.signal);
    } catch (error) {
      playing = Promise.reject(error);
    }
    playing.then(done, done);
  }
}

export const playWithAudioElement: PlayClip = (url, signal) => new Promise((resolve, reject) => {
  if (signal.aborted) {
    resolve();
    return;
  }
  const audio = new Audio(url);
  audio.addEventListener('ended', () => resolve(), { once: true });
  audio.addEventListener('error', () => reject(new Error(`the clip ${url} did not play`)), { once: true });
  signal.addEventListener('abort', () => {
    audio.pause();
    resolve();
  }, { once: true });
  audio.play().catch(reject);
});
