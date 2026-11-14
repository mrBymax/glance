import type { Caption, ServerEvent } from '@glance/shared';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { expect, it } from 'vitest';
import { event, SNAPSHOT } from '../test/events';
import { fakeFetch, fakeSources, type FakeFetch, type FakeSources } from '../test/fakes';
import { renderWithTheme } from '../test/render';
import { MirrorPage } from './MirrorPage';

type Answer = { status?: number; json?: unknown };
type Deps = { http: FakeFetch; sources: FakeSources; played: string[]; latest: Answer; snapshotErrors: Answer[] };

/**
 * The fake server answers the snapshot fixture with `captions`, and `latest` for the demo path.
 * Each entry of `snapshotErrors` answers one snapshot call before the fixture does.
 */
function deps(captions: Caption[] = []): Deps {
  const d: Deps = {
    latest: { json: { sessionId: 's-9', token: 't-9' } },
    snapshotErrors: [],
    http: fakeFetch((_method, url) => {
      if (url.startsWith('/api/demo/latest')) return d.latest;
      return d.snapshotErrors.shift() ?? { json: { ...SNAPSHOT, captions } };
    }),
    sources: fakeSources(),
    played: [],
  };
  return d;
}

const renderMirror = (address: string, d: Deps) => renderWithTheme(
  <MemoryRouter initialEntries={[address]}>
    <MirrorPage
      fetchFn={d.http.fetch}
      createEventSource={d.sources.create}
      playClip={async (url) => { d.played.push(url); }}
      latestPollMs={10}
      retryMs={10}
    />
  </MemoryRouter>,
);
const stream = (d: Deps) => d.sources.sources[0];
const emit = (d: Deps, message: ServerEvent | string) =>
  act(() => d.sources.sources.at(-1)?.emit('message', typeof message === 'string' ? message : JSON.stringify(message)));
const pressStart = () => fireEvent.click(screen.getByRole('button', { name: 'Start mirror' }));
const lastCaption = SNAPSHOT.captions.at(-1)!.text;
const start = async (d: Deps) => {
  const view = renderMirror('/mirror?s=s-1&t=t-1', d);
  pressStart();
  act(() => stream(d)?.emit('open'));
  await waitFor(() => expect(d.http.calls).toHaveLength(1));
  return view;
};
const line = (id: string, text: string, url: string | null): ServerEvent => ({ ...event('caption'), id, text, url });

it('asks for the session and the token when the address has none', () => {
  renderMirror('/mirror', deps());
  expect(screen.getByText('Add ?latest=, or ?s= and ?t=, to the address.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Start mirror' })).toBeNull();
});
it('follows the newest session of the phone with the flag latest', async () => {
  const d = deps();
  renderMirror('/mirror?latest=k-demo', d);
  pressStart();
  await waitFor(() => expect(stream(d)?.url).toBe('/api/sessions/s-9/events?token=t-9'));
  expect(d.http.calls[0]).toMatchObject({ method: 'GET', url: '/api/demo/latest?key=k-demo' });
});
it('waits while the phone has no session, then opens the session', async () => {
  const d = deps();
  d.latest = { status: 404 };
  renderMirror('/mirror?latest=k-demo', d);
  pressStart();
  expect(await screen.findByText('Waiting for a session on the phone.')).toBeInTheDocument();
  expect(d.sources.sources).toHaveLength(0);
  d.latest = { json: { sessionId: 's-9', token: 't-9' } };
  await waitFor(() => expect(stream(d)?.url).toBe('/api/sessions/s-9/events?token=t-9'));
  await waitFor(() => expect(screen.queryByText('Waiting for a session on the phone.')).toBeNull());
});
it('closes the stream and opens the new one when the phone starts another session', async () => {
  const d = deps();
  renderMirror('/mirror?latest=k-demo', d);
  pressStart();
  await waitFor(() => expect(d.sources.sources).toHaveLength(1));
  emit(d, line('c-1', 'A line of the first session.', null));
  expect(await screen.findByText('A line of the first session.')).toBeInTheDocument();
  d.latest = { json: { sessionId: 's-10', token: 't-10' } };
  await waitFor(() => expect(d.sources.sources).toHaveLength(2));
  expect(d.sources.sources[0]?.closed).toBe(true);
  expect(d.sources.sources[1]?.url).toBe('/api/sessions/s-10/events?token=t-10');
  await waitFor(() => expect(screen.queryByText('A line of the first session.')).toBeNull());
  // More answers with the same session must not open one more stream.
  await new Promise((resolve) => { setTimeout(resolve, 50); });
  expect(d.sources.sources).toHaveLength(2);
});
it('keeps the session on the screen while the demo path gives no answer', async () => {
  const d = deps();
  renderMirror('/mirror?latest=k-demo', d);
  pressStart();
  await waitFor(() => expect(d.sources.sources).toHaveLength(1));
  emit(d, line('c-1', 'A line of the session.', null));
  d.latest = { status: 404 };
  await new Promise((resolve) => { setTimeout(resolve, 50); });
  expect(screen.getByText('A line of the session.')).toBeInTheDocument();
  expect(stream(d)?.closed).toBe(false);
  expect(screen.queryByText('Waiting for a session on the phone.')).toBeNull();
});
it('says that it is a demo tool', () => {
  renderMirror('/mirror?s=s-1&t=t-1', deps());
  expect(screen.getByText('Demo mirror. It shows what the glasses say.')).toBeInTheDocument();
});
it('makes no network call before the start', () => {
  const d = deps();
  renderMirror('/mirror?s=s-1&t=t-1', d);
  expect(d.http.calls).toEqual([]);
  expect(d.sources.sources).toEqual([]);
});
it('starts on a button, then shows the captions and the cart of the session', async () => {
  const d = deps();
  await start(d);
  expect(stream(d)?.url).toBe('/api/sessions/s-1/events?token=t-1');
  expect(d.http.calls.map((call) => `${call.method} ${call.url}`)).toEqual(['GET /api/sessions/s-1?token=t-1']);
  emit(d, line('c-1', 'A line for the mirror.', null));
  expect(await screen.findByText('A line for the mirror.')).toHaveClass('mirror-caption-current');
  emit(d, event('cart.updated'));
  expect(await screen.findByText('4.49 EUR')).toBeInTheDocument();
  for (const item of event('cart.updated').cart.items) expect(screen.getByText(item.name)).toBeInTheDocument();
});
it('shows the newest caption first and as the current one, with its language', async () => {
  const d = deps();
  await start(d);
  emit(d, line('c-1', 'The first line.', null));
  emit(d, { ...line('c-2', 'La seconda riga.', null), lang: 'it' } as ServerEvent);
  expect(await screen.findByText('La seconda riga.')).toHaveClass('mirror-caption-current');
  expect(screen.getByText('La seconda riga.')).toHaveAttribute('lang', 'it');
  expect(screen.getByText('The first line.')).toHaveClass('mirror-caption-old');
  const shown = screen.getAllByText(/ (line|riga).$/).map((caption) => caption.textContent);
  expect(shown).toEqual(['La seconda riga.', 'The first line.']);
});
it('plays the clip of each new caption, and skips a caption with no clip', async () => {
  const d = deps();
  await start(d);
  emit(d, line('c-1', 'With a clip.', 'https://glance.example/api/speech/abc.mp3'));
  emit(d, line('c-2', 'With no clip.', null));
  await waitFor(() => expect(d.played).toEqual(['https://glance.example/api/speech/abc.mp3']));
});
it('resolves a clip path against the origin of the page', async () => {
  const d = deps();
  await start(d);
  emit(d, line('c-1', 'With a path.', '/api/speech/abc.mp3'));
  await waitFor(() => expect(d.played).toEqual([`${location.origin}/api/speech/abc.mp3`]));
});
it('plays the clip of one caption one time', async () => {
  const d = deps();
  await start(d);
  emit(d, line('c-1', 'One line.', 'https://glance.example/api/speech/abc.mp3'));
  emit(d, line('c-1', 'One line.', 'https://glance.example/api/speech/abc.mp3'));
  emit(d, line('c-2', 'The next line.', 'https://glance.example/api/speech/def.mp3'));
  await waitFor(() => expect(d.played).toHaveLength(2));
  expect(d.played).toEqual(['https://glance.example/api/speech/abc.mp3', 'https://glance.example/api/speech/def.mp3']);
});
it('shows the captions of the snapshot and plays no clip for them', async () => {
  const d = deps(SNAPSHOT.captions);
  await start(d);
  expect(await screen.findByText(lastCaption)).toHaveClass('mirror-caption-current');
  expect(d.played).toEqual([]);
});
it('asks for the snapshot again after a call that failed', async () => {
  const d = deps(SNAPSHOT.captions);
  d.snapshotErrors = [{ status: 502 }, { json: { sessionId: 's-1' } }];
  await start(d);
  expect(await screen.findByText(lastCaption)).toBeInTheDocument();
  expect(d.http.calls).toHaveLength(3);
});
it('does not ask for the snapshot again after the server refused the session', async () => {
  const d = deps(SNAPSHOT.captions);
  d.snapshotErrors = [{ status: 401, json: { error: 'unauthorized' } }];
  await start(d);
  await new Promise((resolve) => { setTimeout(resolve, 50); });
  expect(d.http.calls).toHaveLength(1);
  expect(screen.queryByText(lastCaption)).toBeNull();
});
it('plays no clip while muted, and plays again after unmute', async () => {
  const d = deps();
  await start(d);
  fireEvent.click(screen.getByRole('button', { name: 'Mute' }));
  emit(d, line('c-1', 'A muted line.', 'https://glance.example/api/speech/a.mp3'));
  expect(await screen.findByText('A muted line.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Unmute' }));
  emit(d, line('c-2', 'A loud line.', 'https://glance.example/api/speech/b.mp3'));
  await waitFor(() => expect(d.played).toEqual(['https://glance.example/api/speech/b.mp3']));
});
it('drops a message that is not JSON or not an event', async () => {
  const d = deps();
  await start(d);
  emit(d, 'not json');
  emit(d, JSON.stringify({ type: 'from.a.newer.server' }));
  emit(d, line('c-1', 'Still alive.', null));
  expect(await screen.findByText('Still alive.')).toBeInTheDocument();
});
it('says that the connection is lost, then loads the snapshot again', async () => {
  const d = deps();
  await start(d);
  emit(d, event('cart.updated'));
  act(() => stream(d)?.emit('error'));
  expect(await screen.findByText('Connection lost. Reconnecting.')).toBeInTheDocument();
  expect(screen.getByText('4.49 EUR')).toBeInTheDocument();
  act(() => stream(d)?.emit('open'));
  await waitFor(() => expect(d.http.calls).toHaveLength(2));
  await waitFor(() => expect(screen.queryByText('Connection lost. Reconnecting.')).toBeNull());
});
it('opens a new stream after the server refused the old one', async () => {
  const d = deps();
  await start(d);
  const first = stream(d)!;
  first.readyState = 2;
  act(() => first.emit('error'));
  expect(await screen.findByText('Connection lost. Reconnecting.')).toBeInTheDocument();
  await waitFor(() => expect(d.sources.sources).toHaveLength(2));
  expect(first.closed).toBe(true);
  expect(d.sources.sources[1]?.url).toBe('/api/sessions/s-1/events?token=t-1');
});
it('plays the recorded run with no network call', async () => {
  const d = deps();
  renderMirror('/mirror?replay=1', d);
  pressStart();
  expect(await screen.findByText('Camera on. Hold a product up to hear its price.', undefined, { timeout: 2000 })).toBeInTheDocument();
  expect(d.http.calls).toEqual([]);
  expect(d.sources.sources).toEqual([]);
});
it('closes the stream when the page goes away', async () => {
  const d = deps();
  const view = await start(d);
  view.unmount();
  expect(stream(d)?.closed).toBe(true);
});
