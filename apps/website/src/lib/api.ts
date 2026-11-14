import { CreateKioskResponseSchema, type CreateKioskRequest, type CreateKioskResponse } from '@glance/shared';

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
