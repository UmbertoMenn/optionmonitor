import { Position } from '@/types/portfolio';
import { UnderlyingPrice } from '@/hooks/useUnderlyingPrices';
import { bsPrice, impliedVolatility } from '@/lib/blackScholes';
import { parseBondPartial, bondYTM, bondCleanPrice, BondInfo } from '@/lib/bondMath';

const MS_YEAR = 365.25 * 24 * 3600 * 1000;
const DEFAULT_RATE = 0.04;        // risk-free di base per il pricing opzioni
const DEFAULT_OPT_VOL = 0.30;     // vol di fallback quando l'IV non è risolvibile
const DEFAULT_EQUITY_VOL = 0.20;  // vol annua per lo shock aggregato azioni/ETF (MC titoli)

function yearFrac(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / MS_YEAR;
}

// ───────────────────────── Inputs precomputati ─────────────────────────

interface DerivInput {
  description: string;
  underlying: string;
  type: 'call' | 'put';
  S0: number;            // prezzo sottostante corrente
  K: number;
  T0: number;            // anni a scadenza da t0
  iv: number;            // IV implicita (o fallback)
  ivResolved: boolean;
  qtyMult: number;       // quantity * 100 / fx  (segno incluso)
  anchorPerShare: number;// prezzo opzione corrente (per decadimento lineare di fallback)
  hasUnderlying: boolean;
  mvT0: number;          // market value EUR a t0
}

interface BondInput {
  description: string;
  info: BondInfo;
  currentClean: number;  // prezzo % corrente
  ytm: number;
  mvT0: number;          // market value EUR a t0
  couponCashPerPeriod: number; // EUR per cedola (0 se cedola non modellata)
  couponsModeled: boolean;
}

/** Override risolto per ISIN, chiave `${portfolio_id}::${isin}`. */
export interface ResolvedBondOverride {
  couponRatePct: number | null;
  maturityMs: number | null;
  frequency: number;
}

export interface ProjectionInputs {
  t0: Date;
  horizon: Date;
  flatNonBondEquity: number; // commodity + cash + bond non proiettabili, costante (EUR)
  equityFlat: number;        // azioni + ETF aggregati (EUR) — shockabili nel MC titoli
  derivs: DerivInput[];
  bonds: BondInput[];
  unparsedBonds: string[];   // bond senza scadenza deducibile → tenuti piatti
  partialBonds: string[];    // bond con scadenza ma senza cedola → pull-to-par, cedole non modellate
  derivsNoUnderlying: string[];
  patrimonyT0: number;
}

export function buildProjectionInputs(
  positions: Position[],
  baseValue: number,
  underlyingPrices?: Record<string, UnderlyingPrice>,
  bondOverrides?: Record<string, ResolvedBondOverride>,
): ProjectionInputs {
  const t0 = new Date();
  const fxOf = (p: Position) => (p.exchange_rate && p.exchange_rate > 0 ? p.exchange_rate : 1);
  const upx = (key: string) => underlyingPrices?.[key]?.price ?? 0;

  const derivs: DerivInput[] = [];
  const derivsNoUnderlying: string[] = [];
  let maxExpiry = 0;

  for (const p of positions) {
    if (p.asset_type !== 'derivative' || !p.option_type) continue;
    const anchor = p.snapshot_price ?? p.current_price ?? 0;
    const qty = p.quantity;
    const fx = fxOf(p);
    const qtyMult = (qty * 100) / fx;
    const mvT0 = anchor * qtyMult;
    const K = p.strike_price ?? 0;
    const expiry = p.expiry_date ? new Date(p.expiry_date) : null;
    const T0 = expiry ? Math.max(0, yearFrac(t0, expiry)) : 0;
    if (expiry && expiry.getTime() > maxExpiry) maxExpiry = expiry.getTime();
    const S0 = upx(p.underlying || p.description || '');
    const hasUnderlying = S0 > 0;
    if (!hasUnderlying) derivsNoUnderlying.push(p.description);

    let iv = DEFAULT_OPT_VOL;
    let ivResolved = false;
    if (hasUnderlying && T0 > 0 && anchor > 0) {
      const solved = impliedVolatility(anchor, S0, K, T0, DEFAULT_RATE, p.option_type);
      if (isFinite(solved) && solved > 0) { iv = solved; ivResolved = true; }
    }

    derivs.push({
      description: p.description,
      underlying: p.underlying || p.description || '',
      type: p.option_type,
      S0, K, T0, iv, ivResolved,
      qtyMult, anchorPerShare: anchor, hasUnderlying, mvT0,
    });
  }

  const bonds: BondInput[] = [];
  const unparsedBonds: string[] = [];
  const partialBonds: string[] = [];
  let parsedBondMV = 0;   // SOLO i bond effettivamente proiettati (da sottrarre dal flat)
  let equityFlat = 0;

  for (const p of positions) {
    const mvEUR = p.snapshot_market_value ?? p.market_value ?? 0;
    if (p.asset_type === 'bond') {
      const ov = p.isin ? bondOverrides?.[`${p.portfolio_id}::${p.isin}`] : undefined;
      const partial = parseBondPartial(p.description);
      const maturity = ov?.maturityMs != null ? new Date(ov.maturityMs) : partial.maturity;
      const couponRatePct = ov ? ov.couponRatePct : partial.couponRatePct; // override vince (anche se null)
      const frequency = ov?.frequency ?? partial.frequency;
      const currentClean = p.snapshot_price ?? p.current_price ?? 0;

      if (maturity && isFinite(maturity.getTime()) && currentClean > 0 && mvEUR !== 0) {
        parsedBondMV += mvEUR;
        if (maturity.getTime() > maxExpiry) maxExpiry = maturity.getTime();
        const info: BondInfo = { couponRatePct: couponRatePct ?? 0, maturity, frequency, parsedFrom: ov ? 'override' : 'auto' };
        const ytm = bondYTM(info, currentClean, t0);
        const couponsModeled = couponRatePct != null && couponRatePct > 0;
        const couponCashPerPeriod = couponsModeled ? (mvEUR * (couponRatePct as number)) / (currentClean * frequency) : 0;
        bonds.push({ description: p.description, info, currentClean, ytm, mvT0: mvEUR, couponCashPerPeriod, couponsModeled });
        if (!couponsModeled) partialBonds.push(p.description);
      } else {
        // scadenza non deducibile → resta nel bucket flat (NON sottratto): tenuto al valore corrente
        unparsedBonds.push(p.description);
      }
    } else if (p.asset_type === 'stock' || p.asset_type === 'etf') {
      equityFlat += mvEUR;
    }
  }

  // baseValue (summary.totalValue) = non-derivati a MV + cash. Sottraiamo SOLO i bond proiettati
  // (riaggiunti tramite bonds[]) e l'azionario (shockabile). Tutto il resto — cash, commodity e i
  // bond non proiettabili — resta costante nel bucket flat, così il patrimonio a t0 coincide col reale.
  const flatNonBondEquity = baseValue - parsedBondMV - equityFlat;

  // Orizzonte: max scadenza tra bond e derivati; se assente, +1 anno di default.
  const horizon = maxExpiry > 0 ? new Date(maxExpiry) : new Date(t0.getTime() + MS_YEAR);

  // patrimonio a t0 sotto netting totale = base + Σ MV derivati
  const derivMVT0 = derivs.reduce((s, d) => s + d.mvT0, 0);
  const patrimonyT0 = baseValue + derivMVT0;

  return {
    t0, horizon, flatNonBondEquity, equityFlat, derivs, bonds,
    unparsedBonds, partialBonds, derivsNoUnderlying, patrimonyT0,
  };
}

// ───────────────────────── Time grid ─────────────────────────

export interface TimePoint { date: Date; tYears: number; label: string; }

const MONTHS_IT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

/** Punti mensili da t0 a horizon; se l'orizzonte è lungo, dirada per non superare maxPoints. */
export function buildTimeGrid(t0: Date, horizon: Date, maxPoints = 60): TimePoint[] {
  const totalMonths = Math.max(1, Math.ceil(yearFrac(t0, horizon) * 12));
  const step = Math.max(1, Math.ceil(totalMonths / maxPoints));
  const points: TimePoint[] = [];
  for (let m = 0; m <= totalMonths; m += step) {
    const d = new Date(Date.UTC(t0.getUTCFullYear(), t0.getUTCMonth() + m, t0.getUTCDate()));
    points.push({ date: d, tYears: Math.max(0, yearFrac(t0, d)), label: `${MONTHS_IT[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}` });
  }
  // assicura che l'ultimo punto sia esattamente l'orizzonte
  const last = points[points.length - 1];
  if (!last || Math.abs(last.date.getTime() - horizon.getTime()) > 20 * 24 * 3600 * 1000) {
    points.push({ date: horizon, tYears: Math.max(0, yearFrac(t0, horizon)), label: `${MONTHS_IT[horizon.getUTCMonth()]} ${String(horizon.getUTCFullYear()).slice(2)}` });
  }
  return points;
}

// ───────────────────────── Shock set ─────────────────────────

export interface ShockSet {
  volMult: number;     // moltiplicatore IV (1 = invariata)
  rateBump: number;    // +/- assoluto su tassi (es. 0.01 = +100bp)
  equityMult: number;  // moltiplicatore prezzi azioni/ETF e sottostanti (1 = invariato)
  underlyingMult: Record<string, number>; // override per singolo sottostante (MC titoli)
}

const NO_SHOCK: ShockSet = { volMult: 1, rateBump: 0, equityMult: 1, underlyingMult: {} };

/** Valore patrimonio a una data sotto un set di shock. */
function patrimonyAt(inp: ProjectionInputs, tp: TimePoint, sh: ShockSet): number {
  const r = DEFAULT_RATE + sh.rateBump;

  // derivati: repricing BS con T residuo, S shockato, IV shockata
  let derivVal = 0;
  for (const d of inp.derivs) {
    if (!d.hasUnderlying) { derivVal += d.mvT0; continue; } // niente sottostante: piatto
    const Tt = Math.max(0, d.T0 - tp.tYears);
    const sMult = sh.underlyingMult[d.underlying] ?? sh.equityMult;
    const S = d.S0 * sMult;
    if (d.ivResolved) {
      const px = bsPrice(S, d.K, Tt, r, d.iv * sh.volMult, d.type);
      derivVal += px * d.qtyMult;
    } else {
      // fallback model-free: decadimento lineare dell'estrinseco verso l'intrinseco
      const intrinsic = d.type === 'call' ? Math.max(0, S - d.K) : Math.max(0, d.K - S);
      const frac = d.T0 > 0 ? Tt / d.T0 : 0;
      const px = intrinsic + Math.max(0, d.anchorPerShare - intrinsic) * frac;
      derivVal += px * d.qtyMult;
    }
  }

  // bond: pull-to-par con YTM shockato + cedole staccate fino a tp
  let bondVal = 0;
  let coupons = 0;
  for (const b of inp.bonds) {
    const matured = tp.date.getTime() >= b.info.maturity.getTime();
    if (matured) {
      bondVal += b.mvT0 * (100 / b.currentClean); // rimborso a par
    } else {
      const clean = bondCleanPrice(b.info, b.ytm + sh.rateBump, tp.date);
      bondVal += b.mvT0 * (clean / b.currentClean);
    }
    // cedole incassate in (t0, tp]
    const stepMonths = Math.round(12 / b.info.frequency);
    let cd = new Date(b.info.maturity.getTime());
    const paid: number[] = [];
    for (let i = 0; i < 200; i++) {
      if (cd.getTime() <= inp.t0.getTime()) break;
      if (cd.getTime() <= tp.date.getTime()) paid.push(cd.getTime());
      cd = new Date(Date.UTC(cd.getUTCFullYear(), cd.getUTCMonth() - stepMonths, cd.getUTCDate()));
    }
    coupons += paid.length * b.couponCashPerPeriod;
  }

  const equity = inp.equityFlat * sh.equityMult;
  return inp.flatNonBondEquity + equity + bondVal + coupons + derivVal;
}

// ───────────────────────── Proiezione deterministica ─────────────────────────

export interface ProjectionRow {
  label: string;
  tYears: number;
  patrimony: number;
  pnlPct: number;
  // bande MC (opzionali)
  p5?: number; p50?: number; p95?: number;
}

export function projectDeterministic(inp: ProjectionInputs, grid: TimePoint[]): ProjectionRow[] {
  const base = inp.patrimonyT0;
  return grid.map(tp => {
    const v = patrimonyAt(inp, tp, NO_SHOCK);
    return { label: tp.label, tYears: tp.tYears, patrimony: v, pnlPct: base !== 0 ? ((v - base) / base) * 100 : 0 };
  });
}

// ───────────────────────── Monte Carlo ─────────────────────────

// RNG deterministico (mulberry32) + Box-Muller per normali.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(rand: () => number): number {
  let u = 0, v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export interface MonteCarloConfig {
  enableVolRates: boolean;
  enableUnderlying: boolean;
  volSigma: number;   // dev std relativa della vol (es. 0.25 = ±25%)
  rateSigma: number;  // dev std assoluta tassi (es. 0.01 = ±100bp)
  paths: number;
}

export const DEFAULT_MC: MonteCarloConfig = {
  enableVolRates: true,
  enableUnderlying: false,
  volSigma: 0.25,
  rateSigma: 0.01,
  paths: 300,
};

/** Per ogni punto temporale calcola p5/p50/p95 del patrimonio simulando shock indipendenti. */
export function projectMonteCarlo(
  inp: ProjectionInputs,
  grid: TimePoint[],
  cfg: MonteCarloConfig,
): ProjectionRow[] {
  const rand = mulberry32(0xC0FFEE);
  const base = inp.patrimonyT0;
  const underlyings = Array.from(new Set(inp.derivs.map(d => d.underlying).filter(Boolean)));

  // matrice [point][path]
  const samples: number[][] = grid.map(() => []);

  for (let p = 0; p < cfg.paths; p++) {
    // shock costanti per path (vol/tassi), e drift GBM per i sottostanti (titoli)
    const volMult = cfg.enableVolRates ? Math.max(0.05, 1 + cfg.volSigma * gauss(rand)) : 1;
    const rateBump = cfg.enableVolRates ? cfg.rateSigma * gauss(rand) : 0;

    // per il MC titoli: un fattore browniano per sottostante e per l'azionario aggregato
    const uZ: Record<string, number> = {};
    underlyings.forEach(u => { uZ[u] = gauss(rand); });
    const eqZ = gauss(rand);

    for (let i = 0; i < grid.length; i++) {
      const tp = grid[i];
      let underlyingMult: Record<string, number> = {};
      let equityMult = 1;
      if (cfg.enableUnderlying) {
        const t = Math.max(0, tp.tYears);
        const sq = Math.sqrt(t);
        underlyingMult = {};
        underlyings.forEach(u => {
          const sigma = (inp.derivs.find(d => d.underlying === u)?.iv) || DEFAULT_OPT_VOL;
          underlyingMult[u] = Math.exp((DEFAULT_RATE - 0.5 * sigma * sigma) * t + sigma * sq * uZ[u]);
        });
        equityMult = Math.exp((DEFAULT_RATE - 0.5 * DEFAULT_EQUITY_VOL * DEFAULT_EQUITY_VOL) * t + DEFAULT_EQUITY_VOL * sq * eqZ);
      }
      const sh: ShockSet = { volMult, rateBump, equityMult, underlyingMult };
      samples[i].push(patrimonyAt(inp, tp, sh));
    }
  }

  const pct = (arr: number[], q: number): number => {
    const s = [...arr].sort((a, b) => a - b);
    const idx = Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))));
    return s[idx];
  };

  return grid.map((tp, i) => {
    const arr = samples[i];
    const p50 = pct(arr, 0.5);
    return {
      label: tp.label,
      tYears: tp.tYears,
      patrimony: p50,
      pnlPct: base !== 0 ? ((p50 - base) / base) * 100 : 0,
      p5: pct(arr, 0.05),
      p50,
      p95: pct(arr, 0.95),
    };
  });
}
