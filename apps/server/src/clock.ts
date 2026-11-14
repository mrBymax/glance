/** The time source of the runtime. A test passes its own clock. */
export type Clock = { now(): number };

export const systemClock: Clock = { now: () => Date.now() };
