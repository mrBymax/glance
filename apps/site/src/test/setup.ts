import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// jsdom has no matchMedia. HeroStage reads prefers-reduced-motion. The stub answers "no" to each query.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({ matches: false, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }) as MediaQueryList;
}

// jsdom has no canvas. A null context reads as "no WebGL", as in a browser without it.
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;

// jsdom has no ResizeObserver and no IntersectionObserver. The header measures itself, and Motion checks the view.
// These stubs observe nothing: in jsdom no element ever enters the view, so each element keeps its server state.
class NoObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
window.ResizeObserver ??= NoObserver as unknown as typeof ResizeObserver;
window.IntersectionObserver ??= NoObserver as unknown as typeof IntersectionObserver;
