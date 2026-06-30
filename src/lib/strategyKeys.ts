import { Position } from '@/types/portfolio';

/**
 * Canonical strategy_key helpers.
 *
 * IMPORTANT: these MUST stay in sync with the keys produced in
 * `src/lib/strategyCache.ts` (which writes the `strategy_cache` table read by
 * the `check-alerts` edge function). Any UI that needs to reference a strategy
 * by key (e.g. the "PUT da rollare al rialzo" flag) must build the key here so
 * it matches the cache/edge-function exactly.
 *
 * The keys are intentionally derived from STABLE attributes (underlying, strike,
 * expiry month) and NOT from volatile position UUIDs, so they survive both a
 * cache rebuild and a fresh snapshot re-import.
 */

/** YYYYMM from an ISO date, or 'noexp' when missing. */
export function formatExpiryKey(expiry: string | null | undefined): string {
  if (!expiry) return 'noexp';
  const d = new Date(expiry);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Underlying token used inside strategy keys for an option position. */
export function underlyingKeyForPosition(p: Pick<Position, 'underlying' | 'description'>): string {
  return p.underlying || p.description || '';
}

/** Naked Put strategy key: np_{underlying}_{strike}_{YYYYMM}. */
export function nakedPutKey(
  underlying: string,
  strike: number | null | undefined,
  expiry: string | null | undefined,
): string {
  return `np_${underlying}_${strike || 0}_${formatExpiryKey(expiry)}`;
}

/** Build the Naked Put strategy key straight from a (sold put) position. */
export function nakedPutKeyForPosition(p: Position): string {
  return nakedPutKey(underlyingKeyForPosition(p), p.strike_price, p.expiry_date);
}

/** Covered Call strategy key: cc_{underlying}_{strike}_{YYYYMM}. */
export function coveredCallKey(
  underlying: string,
  strike: number | null | undefined,
  expiry: string | null | undefined,
): string {
  return `cc_${underlying}_${strike || 0}_${formatExpiryKey(expiry)}`;
}

/** Build the Covered Call strategy key from the sold-call position. */
export function coveredCallKeyForPosition(p: Position): string {
  return coveredCallKey(underlyingKeyForPosition(p), p.strike_price, p.expiry_date);
}

/** De-Risking Covered Call strategy key: dcc_{underlying}_{strike}_{YYYYMM}. */
export function deRiskingCoveredCallKey(
  underlying: string,
  strike: number | null | undefined,
  expiry: string | null | undefined,
): string {
  return `dcc_${underlying}_${strike || 0}_${formatExpiryKey(expiry)}`;
}

/** Build the De-Risking Covered Call strategy key from the sold-call position. */
export function deRiskingCoveredCallKeyForPosition(p: Position): string {
  return deRiskingCoveredCallKey(underlyingKeyForPosition(p), p.strike_price, p.expiry_date);
}

/** True when the position is a sold put (the leg a roll-up flag attaches to). */
export function isSoldPut(p: Position): boolean {
  return p.option_type === 'put' && p.quantity < 0;
}
