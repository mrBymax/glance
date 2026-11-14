import type { FastifyBaseLogger } from 'fastify';
import { type BarcodeSource, normalizeGtin } from '@glance/shared';
import type { SessionRuntime } from '../sessions/runtime';
import type { ProductResolver } from './resolver';

/**
 * Who read the code. `barcode` and `ocr` are the readers of the phone. `model` is the recognition call of a stream frame,
 * and `label` is the model call for the still of a label.
 */
export type CodeSource = BarcodeSource | 'model' | 'label';

/** `dropped`: the lookup failed, the session stopped before its end, or the result came after the result of a later report of another code. */
export type ReportResult = 'product' | 'notInStore' | 'invalid' | 'dropped';

export type BarcodeReport = (session: SessionRuntime, code: string, source: CodeSource) => Promise<ReportResult>;

/**
 * Makes the function that takes each code of a session: it checks the code, finds its product, and gives the rules
 * the outcome. The lookup runs before the rules, as the lookup of a kiosk code does.
 * A model reads print and can write digits that are not there. So a code of the model reaches the rules only
 * as a product: the voice never says "not in this store" for digits that only the model read.
 * A lookup can take 2500 ms, so a result can arrive after the result of a later report. Then the shopper shows
 * another code now, and the late result is dropped. The function never rejects.
 */
export function createBarcodeReports(deps: {
  resolver: Pick<ProductResolver, 'resolve'>; log: Pick<FastifyBaseLogger, 'info' | 'warn'>;
}): BarcodeReport {
  /** For each session: the count of its reports, and the newest report that reached the rules. */
  const order = new WeakMap<SessionRuntime, { reports: number; newest: { report: number; gtin: string } | null }>();

  return async (session, code, source) => {
    if (session.stopped) return 'dropped';
    const turn = order.get(session) ?? { reports: 0, newest: null };
    order.set(session, turn);
    turn.reports += 1;
    const report = turn.reports;
    const late = (gtin: string): boolean => turn.newest !== null && turn.newest.report > report && turn.newest.gtin !== gtin;
    const reached = (gtin: string): void => {
      if (turn.newest === null || turn.newest.report < report) turn.newest = { report, gtin };
    };
    const fromPhone = source === 'barcode' || source === 'ocr';
    const startedAt = performance.now();
    const done = (gtin: string, outcome: ReportResult): ReportResult => {
      const ms = Math.round(performance.now() - startedAt);
      deps.log.info(`barcode session=${session.id} source=${source} gtin=${gtin} outcome=${outcome} ms=${ms}`);
      return outcome;
    };

    const gtin = normalizeGtin(code);
    if (gtin === null) {
      if (fromPhone) session.dispatch({ type: 'barcode', outcome: { kind: 'invalid' } });
      return done(code, 'invalid');
    }

    let product: Awaited<ReturnType<ProductResolver['resolve']>>;
    try {
      product = await deps.resolver.resolve(gtin);
    } catch (error) {
      deps.log.warn(`barcode lookup failed. session=${session.id} gtin=${gtin} ${error instanceof Error ? error.message : String(error)}`);
      return 'dropped';
    }
    // The shopper left while the lookup ran.
    if (session.stopped) return 'dropped';

    if (late(gtin)) return done(gtin, 'dropped');
    if (product) {
      reached(gtin);
      session.dispatch({ type: 'barcode', outcome: { kind: 'product', productId: product.id } });
      return done(gtin, 'product');
    }
    if (fromPhone) {
      reached(gtin);
      session.dispatch({ type: 'barcode', outcome: { kind: 'notInStore', gtin } });
    }
    return done(gtin, 'notInStore');
  };
}
