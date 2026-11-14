import { expect, it } from 'vitest';
import { SNAPSHOT } from '../test/events';
import { fakeFetch } from '../test/fakes';
import { ApiError, getLatestSession, getSession, sessionEventsUrl } from './api';

it('reads the snapshot of a session, with the ID and the token encoded', async () => {
  const http = fakeFetch(() => ({ json: SNAPSHOT }));
  expect(await getSession('s 1', 't&1', http.fetch)).toEqual(SNAPSHOT);
  expect(http.calls).toEqual([{ method: 'GET', url: '/api/sessions/s%201?token=t%261', body: undefined }]);
  expect(sessionEventsUrl('s 1', 't&1')).toBe('/api/sessions/s%201/events?token=t%261');
});
it('rejects a snapshot answer that is an error or has the wrong shape, with no token in the message', async () => {
  const refused = getSession('s-1', 't-secret', fakeFetch(() => ({ status: 401, json: { error: 'unauthorized' } })).fetch);
  await expect(refused).rejects.toBeInstanceOf(ApiError);
  await expect(refused).rejects.not.toThrow(/t-secret/);
  await expect(getSession('s-1', 't-1', fakeFetch(() => ({ json: { sessionId: 's-1' } })).fetch)).rejects.toBeInstanceOf(ApiError);
});
it('reads the newest session of the demo path', async () => {
  const http = fakeFetch(() => ({ json: { sessionId: 's-9', token: 't-9' } }));
  expect(await getLatestSession('k demo', http.fetch)).toEqual({ sessionId: 's-9', token: 't-9' });
  expect(http.calls[0]?.url).toBe('/api/demo/latest?key=k%20demo');
});
it('gives null while no session is live, and rejects each other answer that is no session', async () => {
  expect(await getLatestSession('k', fakeFetch(() => ({ status: 404, json: { error: 'not_found' } })).fetch)).toBeNull();
  await expect(getLatestSession('k', fakeFetch(() => ({ status: 500 })).fetch)).rejects.toBeInstanceOf(ApiError);
  await expect(getLatestSession('k', fakeFetch(() => ({ json: { sessionId: 's-9' } })).fetch)).rejects.toBeInstanceOf(ApiError);
});
