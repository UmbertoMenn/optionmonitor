/**
 * IV Surface construction – manual curve and market-data based.
 */

export interface IVPoint {
  strike: number;
  expiry: string;
  iv: number;
  optionType: 'call' | 'put';
  volume?: number;
}

export interface IVSurface {
  points: IVPoint[];
  expiries: string[];
  riskFreeRate: number;
  getIV(strike: number, expiry: string, type: 'call' | 'put'): number;
}

/* ──────────────────────────────────────────────
 *  Manual IV Surface (from interactive curve)
 * ────────────────────────────────────────────── */

export interface ManualIVPoint {
  date: string; // YYYY-MM-DD
  iv: number;   // decimal, e.g. 0.30
}

/**
 * Build an IVSurface from the admin's manual IV curve.
 * IV is flat across strikes and option types – only varies over time.
 */
export function buildManualIVSurface(
  ivPoints: ManualIVPoint[],
  riskFreeRate: number
): IVSurface {
  const sorted = [...ivPoints].sort((a, b) => a.date.localeCompare(b.date));

  function getIV(_strike: number, expiry: string, _type: 'call' | 'put'): number {
    if (sorted.length === 0) return 0.3;
    if (sorted.length === 1) return sorted[0].iv;
    if (expiry <= sorted[0].date) return sorted[0].iv;
    if (expiry >= sorted[sorted.length - 1].date) return sorted[sorted.length - 1].iv;

    for (let i = 0; i < sorted.length - 1; i++) {
      if (expiry >= sorted[i].date && expiry <= sorted[i + 1].date) {
        const t1 = new Date(sorted[i].date).getTime();
        const t2 = new Date(sorted[i + 1].date).getTime();
        const t = new Date(expiry).getTime();
        if (t2 === t1) return sorted[i].iv;
        const w = (t - t1) / (t2 - t1);
        return sorted[i].iv + w * (sorted[i + 1].iv - sorted[i].iv);
      }
    }
    return sorted[sorted.length - 1].iv;
  }

  return {
    points: [],
    expiries: sorted.map(p => p.date),
    riskFreeRate,
    getIV,
  };
}

/* ──────────────────────────────────────────────
 *  Market-data based IV Surface (legacy)
 * ────────────────────────────────────────────── */

import { impliedVolatility, riskFreeFromParity } from './blackScholes';

interface OptionDataPoint {
  strike: number;
  expiry: string;
  type: 'call' | 'put';
  price: number;
  volume: number;
  bid?: number;
  ask?: number;
}

export function buildIVSurface(
  optionData: OptionDataPoint[],
  underlyingPriceByDate: Map<string, number>,
  defaultRate: number = 0.045
): IVSurface {
  const filtered = optionData.filter(d => {
    if (d.volume < 10) return false;
    if (d.bid !== undefined && d.ask !== undefined) {
      const mid = (d.bid + d.ask) / 2;
      if (mid > 0 && (d.ask - d.bid) / mid > 0.5) return false;
    }
    return d.price > 0;
  });

  let riskFreeRate = defaultRate;
  const rateEstimates: number[] = [];

  const byExpiry = new Map<string, OptionDataPoint[]>();
  for (const d of filtered) {
    if (!byExpiry.has(d.expiry)) byExpiry.set(d.expiry, []);
    byExpiry.get(d.expiry)!.push(d);
  }

  const expiries = Array.from(byExpiry.keys()).sort();

  for (const [expiry, points] of byExpiry) {
    const latestDate = Array.from(underlyingPriceByDate.keys()).sort().pop();
    if (!latestDate) continue;
    const S = underlyingPriceByDate.get(latestDate);
    if (!S) continue;

    const calls = points.filter(p => p.type === 'call');
    const puts = points.filter(p => p.type === 'put');

    let bestStrike = 0, bestDist = Infinity;
    for (const c of calls) {
      const dist = Math.abs(c.strike - S);
      if (dist < bestDist) { bestDist = dist; bestStrike = c.strike; }
    }

    if (bestStrike > 0) {
      const call = calls.find(c => c.strike === bestStrike);
      const put = puts.find(p => p.strike === bestStrike);
      if (call && put) {
        const T = yearsBetween(latestDate, expiry);
        if (T > 0) {
          const r = riskFreeFromParity(S, bestStrike, T, call.price, put.price);
          if (r > -0.05 && r < 0.15) rateEstimates.push(r);
        }
      }
    }
  }

  if (rateEstimates.length > 0) {
    riskFreeRate = rateEstimates.reduce((a, b) => a + b, 0) / rateEstimates.length;
  }

  const ivPoints: IVPoint[] = [];
  const latestDate = Array.from(underlyingPriceByDate.keys()).sort().pop();
  const S = latestDate ? underlyingPriceByDate.get(latestDate) : undefined;

  if (S) {
    for (const d of filtered) {
      const T = yearsBetween(latestDate!, d.expiry);
      if (T <= 0) continue;
      const iv = impliedVolatility(d.price, S, d.strike, T, riskFreeRate, d.type);
      if (!isNaN(iv) && iv > 0.01 && iv < 5) {
        ivPoints.push({ strike: d.strike, expiry: d.expiry, iv, optionType: d.type, volume: d.volume });
      }
    }
  }

  return {
    points: ivPoints,
    expiries,
    riskFreeRate,
    getIV: (strike, expiry, type) => interpolateIV(ivPoints, strike, expiry, type),
  };
}

function interpolateIV(points: IVPoint[], strike: number, expiry: string, type: 'call' | 'put'): number {
  const typePoints = points.filter(p => p.optionType === type);
  if (typePoints.length === 0) {
    if (points.length === 0) return 0.3;
    return interpolateFromPoints(points, strike, expiry);
  }
  return interpolateFromPoints(typePoints, strike, expiry);
}

function interpolateFromPoints(points: IVPoint[], strike: number, expiry: string): number {
  const expiries = [...new Set(points.map(p => p.expiry))].sort();
  if (expiries.length === 0) return 0.3;

  let expiryIdx = expiries.findIndex(e => e >= expiry);
  if (expiryIdx === -1) expiryIdx = expiries.length - 1;

  if (expiryIdx === 0 || expiries[expiryIdx] === expiry) {
    return interpolateByStrike(points.filter(p => p.expiry === expiries[expiryIdx]), strike);
  }

  const e1 = expiries[expiryIdx - 1];
  const e2 = expiries[expiryIdx];
  const iv1 = interpolateByStrike(points.filter(p => p.expiry === e1), strike);
  const iv2 = interpolateByStrike(points.filter(p => p.expiry === e2), strike);

  const t1 = new Date(e1).getTime();
  const t2 = new Date(e2).getTime();
  const t = new Date(expiry).getTime();

  if (t2 === t1) return iv1;
  return iv1 + ((t - t1) / (t2 - t1)) * (iv2 - iv1);
}

function interpolateByStrike(points: IVPoint[], strike: number): number {
  if (points.length === 0) return 0.3;
  if (points.length === 1) return points[0].iv;

  const sorted = [...points].sort((a, b) => a.strike - b.strike);
  if (strike <= sorted[0].strike) return sorted[0].iv;
  if (strike >= sorted[sorted.length - 1].strike) return sorted[sorted.length - 1].iv;

  for (let i = 0; i < sorted.length - 1; i++) {
    if (strike >= sorted[i].strike && strike <= sorted[i + 1].strike) {
      const w = (strike - sorted[i].strike) / (sorted[i + 1].strike - sorted[i].strike);
      return sorted[i].iv + w * (sorted[i + 1].iv - sorted[i].iv);
    }
  }
  return sorted[0].iv;
}

function yearsBetween(fromDate: string, toDate: string): number {
  return (new Date(toDate).getTime() - new Date(fromDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
}
