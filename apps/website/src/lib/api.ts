import {
  CreateKioskResponseSchema, LatestSessionResponseSchema, SessionSnapshotSchema,
  type CreateKioskRequest, type CreateKioskResponse, type LatestSessionResponse, type SessionSnapshot,
} from '@glance/shared';

/** The server answered, and the answer is an error or has the wrong shape. */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function jsonOf(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    // A proxy can answer with an HTML page. The schema check of the caller rejects null.
    return null;
  }
}

/** Registers a new kiosk with POST /api/kiosks. Each call makes a new kiosk with a new code. */
export async function createKiosk(request: CreateKioskRequest, fetchFn: typeof fetch = fetch): Promise<CreateKioskResponse> {
  const response = await fetchFn('/api/kiosks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (response.status >= 400) throw new ApiError(`POST /api/kiosks failed with ${response.status}`, response.status);
  // The schema also checks the code, with the same rule as formatKioskCode.
  const created = CreateKioskResponseSchema.safeParse(await jsonOf(response));
  if (!created.success) throw new ApiError('POST /api/kiosks gave an answer that is not a kiosk', response.status);
  return created.data;
}

export function kioskEventsUrl(kioskId: string, token: string): string {
  return `/api/kiosks/${encodeURIComponent(kioskId)}/events?token=${encodeURIComponent(token)}`;
}

const enc = encodeURIComponent;

/** Reads the snapshot of a session with GET /api/sessions/<id>. */
export async function getSession(sessionId: string, token: string, fetchFn: typeof fetch = fetch): Promise<SessionSnapshot> {
  const response = await fetchFn(`/api/sessions/${enc(sessionId)}?token=${enc(token)}`);
  // The message holds no query, because the query holds the token of the session.
  if (response.status >= 400) throw new ApiError(`GET /api/sessions/<id> failed with ${response.status}`, response.status);
  const snapshot = SessionSnapshotSchema.safeParse(await jsonOf(response));
  if (!snapshot.success) throw new ApiError('GET /api/sessions/<id> gave an answer that is not a snapshot', response.status);
  return snapshot.data;
}

export function sessionEventsUrl(sessionId: string, token: string): string {
  return `/api/sessions/${enc(sessionId)}/events?token=${enc(token)}`;
}

/** Reads the newest live session with GET /api/demo/latest. Returns null while no session is live (status 404). */
export async function getLatestSession(key: string, fetchFn: typeof fetch = fetch): Promise<LatestSessionResponse | null> {
  const response = await fetchFn(`/api/demo/latest?key=${enc(key)}`);
  if (response.status === 404) return null;
  if (response.status >= 400) throw new ApiError(`GET /api/demo/latest failed with ${response.status}`, response.status);
  const latest = LatestSessionResponseSchema.safeParse(await jsonOf(response));
  if (!latest.success) throw new ApiError('GET /api/demo/latest gave an answer that is not a session', response.status);
  return latest.data;
}
