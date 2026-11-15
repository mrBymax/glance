// Takes a reference picture of a store item through the glasses of the newest live session of a running server:
//   npm run reference -- <gtin>          one picture of the item
//   npm run reference -- list            each store item with its picture count
//   npm run reference -- remove <gtin>   removes the pictures of the item
// The address is --url <address>, else PUBLIC_BASE_URL, else http://localhost:<PORT>. The key is DEMO_KEY of the environment.
import { pathToFileURL } from 'node:url';
import type { ReferenceListResponse, ReferenceSavedResponse } from '../src/http/demo';

export type ReferenceRun = { ok: boolean; lines: string[] };

/** The server waits 15 seconds for the still, so the command waits a little longer for the answer. */
const ANSWER_TIMEOUT_MS = 20_000;

const USAGE = 'reference: give a code, "list", or "remove <code>". Example: npm run reference -- 3017624010701';

/** What a person does next, for each error answer of the server. */
const NEXT_STEP: Record<string, string> = {
  not_found: 'Set DEMO_KEY to the value of the server. The server also needs DEMO_KEY.',
  bad_request: 'The code needs a right check digit, and the store list must hold it.',
  no_session: 'The server has no live session. Start a session on the phone.',
  no_phone: 'The newest session has no phone on its socket. Start a session on the phone.',
  timeout: 'No still came in 15 seconds. Check that the camera of the glasses runs, then try again.',
  replaced: 'Another reference command started for this session.',
};

function fail(line: string): ReferenceRun {
  return { ok: false, lines: [line] };
}

export async function runReference(argv: readonly string[], env: Record<string, string | undefined>): Promise<ReferenceRun> {
  const args = [...argv];
  const urlAt = args.indexOf('--url');
  const urlFlag = urlAt < 0 ? undefined : args.splice(urlAt, 2)[1];
  const base = (urlFlag || env.PUBLIC_BASE_URL || `http://localhost:${env.PORT || '8080'}`).replace(/\/+$/, '');
  const key = env.DEMO_KEY;
  if (!key) return fail('reference: DEMO_KEY is not set. Set it to the DEMO_KEY of the server.');

  const [first, second] = args;
  if (first === undefined || (first === 'remove' && second === undefined)) return fail(USAGE);
  const method = first === 'list' ? 'GET' : first === 'remove' ? 'DELETE' : 'POST';
  const gtin = first === 'list' ? null : first === 'remove' ? second! : first;
  const query = new URLSearchParams({ key, ...(gtin === null ? {} : { gtin }) });

  let response: Response;
  try {
    response = await fetch(`${base}/api/demo/reference?${query}`, { method, signal: AbortSignal.timeout(ANSWER_TIMEOUT_MS) });
  } catch {
    return fail(`reference: no answer from ${base}. Check the address and that the server runs.`);
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (body as { error?: string } | null)?.error ?? '';
    return fail(`reference: the server answered ${response.status}. ${NEXT_STEP[error] ?? 'See the log of the server.'}`);
  }

  if (method === 'GET') {
    const { items } = body as ReferenceListResponse;
    const total = items.reduce((sum, item) => sum + item.pictures, 0);
    return {
      ok: true,
      lines: [
        ...items.map((item) => `${item.gtin}  ${item.pictures}  ${item.name ?? '(not in the store list)'}`),
        `reference: ${items.length} items, ${total} pictures`,
      ],
    };
  }
  if (method === 'DELETE') {
    const { gtin: code, removed } = body as { gtin: string; removed: number };
    return { ok: true, lines: [`reference: removed ${removed} pictures of ${code}`] };
  }
  const saved = body as ReferenceSavedResponse;
  const count = `${saved.count} ${saved.count === 1 ? 'picture' : 'pictures'}`;
  return {
    ok: true,
    lines: [`reference: saved ${saved.file} for ${saved.gtin} ${saved.name}, ${saved.width} x ${saved.height}, ${saved.bytes} bytes, ${count}`],
  };
}

async function main(): Promise<void> {
  const run = await runReference(process.argv.slice(2), process.env);
  for (const line of run.lines) (run.ok ? console.log : console.error)(line);
  if (!run.ok) process.exitCode = 1;
}

// A test imports this file for runReference. Only the command runs main.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
