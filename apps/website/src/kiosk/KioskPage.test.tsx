import created from '@glance/shared/fixtures/rest/CreateKioskResponse.json';
import fixture from '@glance/shared/fixtures/rest/KioskEvent.json';
import { act, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { expect, it, vi } from 'vitest';
import { fakeFetch, fakeSources, type FakeFetch, type FakeSources } from '../test/fakes';
import { renderWithTheme } from '../test/render';
import { parseKioskEvent } from './kioskModel';
import { KioskPage } from './KioskPage';
import { SPOT_AFTER_MS, SPOT_MS } from './kioskRun';

const base = parseKioskEvent(fixture);
if (!base) throw new Error('fixture rest/KioskEvent.json is not a kiosk event');

const renderKiosk = (address: string, http: FakeFetch, sources: FakeSources) => renderWithTheme(
  <MemoryRouter initialEntries={[address]}>
    <KioskPage fetchFn={http.fetch} createEventSource={sources.create} retryMs={10} />
  </MemoryRouter>,
);
const idleHeading = () => screen.findByRole('heading', { level: 1, name: 'Look at this code to pay' });
const code = (text: string) => screen.queryByRole('img', { name: `Checkout code ${text}` });

it('registers with the flags of the address, shows the code, and follows the stream', async () => {
  const http = fakeFetch(() => ({ json: created }));
  const sources = fakeSources();
  renderKiosk('/kiosk?name=Checkout%205&fail=1', http, sources);
  expect(await screen.findByRole('heading', { level: 1, name: 'Look at this code to pay' })).toBeInTheDocument();
  expect(http.calls).toEqual([{ method: 'POST', url: '/api/kiosks',
    body: { name: 'Checkout 5', store: 'Demo Market', spotCheck: false, failPayment: true } }]);
  expect(screen.getByText('Checkout 5, Demo Market')).toBeInTheDocument();
  expect(sources.sources[0]?.url).toBe(`/api/kiosks/${encodeURIComponent(created.kioskId)}/events?token=${encodeURIComponent(created.token)}`);
  act(() => sources.sources[0]?.emit('message', JSON.stringify({ ...base, state: 'failed' })));
  expect(await screen.findByRole('heading', { level: 1, name: 'Payment failed. Nothing was charged.' })).toBeInTheDocument();
  act(() => sources.sources[0]?.emit('message', 'not json'));
  expect(screen.getByRole('heading', { level: 1, name: 'Payment failed. Nothing was charged.' })).toBeInTheDocument();
});
it('tries again while the server does not answer', async () => {
  let down = true;
  const http = fakeFetch(() => { if (down) throw new Error('down'); return { json: created }; });
  renderKiosk('/kiosk', http, fakeSources());
  expect(await screen.findByRole('heading', { level: 1, name: 'The store server does not answer' })).toBeInTheDocument();
  down = false;
  expect(await screen.findByRole('heading', { level: 1, name: 'Look at this code to pay' })).toBeInTheDocument();
  expect(http.calls.length).toBeGreaterThan(1);
});
it('tries again after an answer that is an error or not a kiosk', async () => {
  const answers = [{ status: 500 }, { json: { kioskId: 'kiosk-1' } }, { json: created }];
  const http = fakeFetch(() => answers.shift() ?? { json: created });
  renderKiosk('/kiosk', http, fakeSources());
  expect(await idleHeading()).toBeInTheDocument();
  expect(http.calls).toHaveLength(3);
});
it('says that the connection is lost, keeps the code and the cart, and takes the view of the stream when it returns', async () => {
  const sources = fakeSources();
  renderKiosk('/kiosk', fakeFetch(() => ({ json: created })), sources);
  await idleHeading();
  const source = sources.sources[0]!;
  act(() => {
    source.emit('open');
    source.emit('message', JSON.stringify(base));
  });
  expect(screen.getByText('4.49 EUR')).toBeInTheDocument();
  act(() => source.emit('error'));
  expect(screen.getByText('Connection lost. Reconnecting.')).toBeInTheDocument();
  expect(code(created.code)).toBeInTheDocument();
  expect(screen.getByText('4.49 EUR')).toBeInTheDocument();
  act(() => {
    source.emit('open');
    source.emit('message', JSON.stringify({ ...base, state: 'idle', cart: null, totalCents: null }));
  });
  expect(screen.queryByText('Connection lost. Reconnecting.')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1, name: 'Look at this code to pay' })).toBeInTheDocument();
  expect(sources.sources).toHaveLength(1);
});
it('registers a new kiosk when the server refuses the stream of the old one', async () => {
  const codes = ['K3X7', 'M2P9'];
  const http = fakeFetch(() => ({ json: { ...created, code: codes.shift() } }));
  const sources = fakeSources();
  renderKiosk('/kiosk', http, sources);
  await idleHeading();
  const first = sources.sources[0]!;
  first.readyState = 2;
  act(() => first.emit('error'));
  expect(screen.getByText('Connection lost. Reconnecting.')).toBeInTheDocument();
  expect(code('K3X7')).toBeInTheDocument();
  await vi.waitFor(() => expect(code('M2P9')).toBeInTheDocument());
  expect(first.closed).toBe(true);
  expect(sources.sources).toHaveLength(2);
  expect(http.calls).toHaveLength(2);
  expect(screen.queryByText('Connection lost. Reconnecting.')).not.toBeInTheDocument();
});
it('closes the stream when the page goes away', async () => {
  const sources = fakeSources();
  const { unmount } = renderKiosk('/kiosk', fakeFetch(() => ({ json: created })), sources);
  await idleHeading();
  unmount();
  expect(sources.sources[0]?.closed).toBe(true);
});
it('plays the recorded run with no network call when the address has the flag replay', async () => {
  vi.useFakeTimers();
  const http = fakeFetch(() => ({ json: created }));
  const sources = fakeSources();
  const { unmount } = renderKiosk('/kiosk?replay=1', http, sources);
  expect(screen.getByRole('heading', { level: 1, name: 'Look at this code to pay' })).toBeInTheDocument();
  act(() => { vi.advanceTimersByTime(3000); });
  expect(screen.getByRole('heading', { level: 1, name: 'Waiting for your nod' })).toBeInTheDocument();
  act(() => { vi.advanceTimersByTime(5000); });
  expect(screen.getByRole('heading', { level: 1, name: 'Paid' })).toBeInTheDocument();
  expect(http.calls).toEqual([]);
  expect(sources.sources).toEqual([]);
  unmount();
  vi.useRealTimers();
});
it('plays the run with a spot check when the address has the flags replay and spot', () => {
  vi.useFakeTimers();
  const http = fakeFetch(() => ({ json: created }));
  const sources = fakeSources();
  const { unmount } = renderKiosk('/kiosk?replay=1&spot=1', http, sources);
  expect(screen.getByRole('heading', { level: 1, name: 'Look at this code to pay' })).toBeInTheDocument();
  act(() => { vi.advanceTimersByTime(3000); });
  expect(screen.getByRole('heading', { level: 1, name: 'Waiting for your nod' })).toBeInTheDocument();
  act(() => { vi.advanceTimersByTime(SPOT_AFTER_MS); });
  expect(screen.getByRole('heading', { level: 1, name: 'Quick check' })).toBeInTheDocument();
  act(() => { vi.advanceTimersByTime(SPOT_MS); });
  expect(screen.getByRole('heading', { level: 1, name: 'Waiting for your nod' })).toBeInTheDocument();
  expect(http.calls).toEqual([]);
  expect(sources.sources).toEqual([]);
  unmount();
  vi.useRealTimers();
});
