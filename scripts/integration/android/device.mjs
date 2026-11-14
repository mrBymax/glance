// The phone and the port of a run of run-spine.mjs. Both come from the environment, so the script names no phone.

/** Thrown when the run cannot start, for example with no phone. run-spine.mjs ends with status 2 then. */
export class Blocked extends Error {}

const DEFAULT_PORT = 8080;
const MAX_PORT = 65535;

/**
 * Returns the serial of the test phone: `ANDROID_SERIAL`, or the one phone in the output of "adb devices".
 * Throws `Blocked` for no phone and for several phones, because a second phone must never get a command.
 */
export function pickSerial(envSerial, adbDevicesOutput) {
  const named = (envSerial ?? '').trim();
  if (named !== '') return named;
  const serials = adbDevicesOutput
    .split(/\r?\n/)
    .map((line) => /^(\S+)\tdevice$/.exec(line)?.[1])
    .filter((serial) => serial !== undefined);
  if (serials.length === 0) throw new Blocked('No phone is attached and ready. Attach one phone, or set ANDROID_SERIAL.');
  if (serials.length > 1) {
    throw new Blocked(`${serials.length} phones are attached. Set ANDROID_SERIAL to the serial of the test phone: ${serials.join(', ')}.`);
  }
  return serials[0];
}

/** Returns the port of the server of a run: `GLANCE_TEST_PORT`, or 8080. */
export function testPort(envPort) {
  const text = (envPort ?? '').trim();
  if (text === '') return DEFAULT_PORT;
  const port = Number(text);
  if (!Number.isInteger(port) || port < 1 || port > MAX_PORT) throw new Error(`GLANCE_TEST_PORT must be a port from 1 to ${MAX_PORT}. It is "${text}".`);
  return port;
}

/**
 * Returns the target of the reverse entry for `port` in the output of "adb reverse --list", or null.
 * A run puts its own entry on that port, and gives the phone the old entry again at its end.
 */
export function reverseTarget(reverseListOutput, port) {
  for (const line of reverseListOutput.split(/\r?\n/)) {
    const [, from, to] = line.trim().split(/\s+/);
    if (from === `tcp:${port}` && to) return to;
  }
  return null;
}
