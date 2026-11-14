import type { PageToNative } from '@glance/shared';
import type { Strings } from '../text/strings';
import { setupStepOf } from './selectors';
import type { UiAction, UiState } from './uiState';

export type BannerId = 'paymentFailed' | 'serverUnreachable' | 'regularCheckout' | 'glassesNotFound' | 'updateRequired'
  | 'ended' | 'resting' | 'stopped' | 'paused' | 'offFace' | 'error' | 'batteryLow';
export type BannerAction = { label: string; send: PageToNative } | { label: string; dispatch: UiAction };
export type BannerModel = {
  id: BannerId;
  status: 'info' | 'warning' | 'error';
  title: string;
  description: string | null;
  action: BannerAction | null;
};

// NativeState has no cause for a stopped stream. These are the limits of cannotStream in the server (Plan 1 Task 6).
/** Percent. At this battery level or below, the glasses cannot stream. */
export const REGULAR_CHECKOUT_BATTERY = 5;
/** Level 0 to 7. At this thermal level or above, the glasses cannot stream. */
export const REGULAR_CHECKOUT_THERMAL = 6;
const LOW_BATTERY = 20;

/** Returns the one banner for the state, or null. The first condition that applies wins, in the order of this function. */
export function bannerOf(state: UiState, strings: Strings): BannerModel | null {
  const { native, error } = state;
  if (!native) return null;
  const text = strings.banner;
  const errorBanner: BannerModel | null = error
    && { id: 'error', status: 'warning', title: error.message, description: null, action: null };
  // The setup screen shows each other state of this time as a step.
  if (setupStepOf(native) < 2) return errorBanner;

  const { device } = native;
  const battery = device?.battery ?? null;
  const thermal = device?.thermal ?? null;
  const startCamera: BannerAction = { label: text.startCamera, send: { t: 'session.start' } };
  const info = (id: BannerId, part: { title: string; description?: string }, action: BannerAction | null = null): BannerModel =>
    ({ id, status: 'info', title: part.title, description: part.description ?? null, action });

  if (state.checkout === 'failed') return { id: 'paymentFailed', status: 'error', ...text.paymentFailed, action: null };
  if (native.network === 'offline') return { id: 'serverUnreachable', status: 'error', ...text.serverUnreachable, action: null };
  const cannotStream = (battery !== null && battery <= REGULAR_CHECKOUT_BATTERY) || (thermal !== null && thermal >= REGULAR_CHECKOUT_THERMAL);
  if (native.session === 'stopped' && cannotStream) return { id: 'regularCheckout', status: 'error', ...text.regularCheckout, action: null };
  if (!device || device.link === 'disconnected') return { id: 'glassesNotFound', status: 'warning', ...text.glassesNotFound, action: null };
  if (device.updateRequired) {
    return { id: 'updateRequired', status: 'warning', ...text.updateRequired, action: { label: text.openUpdate, send: { t: 'setup.openUpdate' } } };
  }
  if (state.phase === 'ended') return info('ended', text.ended, { label: text.newShop, dispatch: { t: 'local.reset' } });
  if (state.phase === 'resting') return info('resting', text.resting, startCamera);
  if (state.sessionId !== null && native.session === 'stopped' && state.phase !== 'paid') {
    return info('stopped', { title: text.cameraOff, description: error?.message }, startCamera);
  }
  if (native.session === 'paused' || native.stream === 'paused') return info('paused', text.paused);
  if (device.worn === false) return info('offFace', text.offFace);
  if (errorBanner) return errorBanner;
  if (battery !== null && battery <= LOW_BATTERY) return info('batteryLow', { title: text.batteryLow(battery) });
  return null;
}
