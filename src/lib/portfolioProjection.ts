import { Position } from '@/types/portfolio';
import { UnderlyingPrice } from '@/hooks/useUnderlyingPrices';
import { bsPrice, impliedVolatility } from '@/lib/blackScholes';
import { parseBondPartial, bondYTM, couponDates, BondInfo } from '@/lib/bondMath';
import { getCanonicalTickerKey } from '@/lib/tickerIdentity';

const MS_YEAR = 365.25 * 24 * 3600 * 1000;
const DEFAULT_RATE = 0.04;        // risk-free di base per il pricing opzioni
const DEFAULT_OPT_VOL = 0.30;     // vol di fallback quando l'IV non è risolvibile
const DEFAULT_EQUITY_VOL = 0.20;  // vol annua per lo shock aggregato azioni/ETF (MC titoli)
const INFLATION_TARGET = 0.02;    // target BCE per i bond indicizzati all'inflazione
const MC_MARKET_CORR = 0.6;       // correlazione dei sottostanti col fattore di mercato (MC titoli)

/** Filtro di analisi: tutto, solo azionario+derivati, solo bond+commodities. */
export type ProjectionScope = 'all' | 'equity' | 'bond_commodity';

function yearFrac(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / MS_YEAR;
}

// ───────────────────────── Inputs precomputati ─────────────────────────

interface DerivInput {
  description: string;
  underlying: string;    // nome grezzo (chiave in underlyingPrices)
  key: string;           // ticker canonico (chiave degli shock MC, condivisa con le azioni)
  type: 'call' | 'put';
  S0: number;            // prezzo sottostante corrente
  K: number;
  T0: number;            // anni a scadenza da t0
  iv: number;            // IV implicita (o fallback)
  ivResolved: boolean;
  qtyMult: number;       // quantity * 100 / fx  (segno incluso)
  anchorPerShare: number;// prezzo opzione corrente
  basisPerShare: number; // anchor − prezzoBS(t0): correzione additiva che decade a 0 a scadenza.
                         // Garantisce che la curva parta ESATTAMENTE dal patrimonio a t0 anche
                         // quando il solver IV non riproduce il prezzo (deep ITM, vega ≈ 0).
  hasUnderlying: boolean;
  mvT0: number;          // market value EUR a t0
}

interface BondInput {
  description: string;
  info: BondInfo;
  ytm: number;
  mvT0: number;                // market value EUR a t0
  cleanT0Model: number;        // prezzo modello a t0 (denominatore del ratio: ancora la curva a t0)
  couponCashPerPeriod: number; // EUR per cedola (0 se cedola non modellata o ZC)
  couponsModeled: boolean;
  inflationLinked: boolean;
  maturityT: number;           // anni a scadenza da t0
  // flussi precomputati (evita Date math dentro patrimonyAt / bondCleanPrice):
  flowT: number[];             // anni da t0 di ogni flusso futuro (cedole; l'ultimo coincide con la scadenza)
  flowAmt: number[];           // importo % del face per flusso (cedola; +100 sull'ultimo per il rimborso)
}

/** Prezzo modello (face=100) a tYears da t0 con rendimento y — usa i flussi precomputati. */
function bondModelPrice(b: BondInput, tYears: number, y: number): number {
  const f = b.info.frequency;
  const periodRate = y / f;
  let pv = 0;
  for (let i = 0; i < b.flowT.length; i++) {
    const dt = b.flowT[i] - tYears;
    if (dt <= 0) continue;
    pv += b.flowAmt[i] * Math.pow(1 + periodRate, -dt * f);
  }
  return pv;
}

/** Override risolto per ISIN, chiave `${portfolio_id}::${isin}`. */
export interface ResolvedBondOverride {
  couponRatePct: number | null;
  maturityMs: number | null;
  frequency: number;
}

export interface DerivSummaryLeg {
  description: string;
  underlying: string;
  type: 'call' | 'put';
  qty: number;
  strike: number;
  mvT0: number;
  hasUnderlying: boolean;
}

export interface ProjectionInputs {
  t0: Date;
  horizon: Date;
  // bucket costanti (EUR)
  equityFlat: number;        // azioni + ETF NON associate a sottostanti di opzioni — shock aggregato
  equityByKey: Record<string, number>; // azioni/ETF associate a un sottostante opzionario (stesso shock MC)
  gpEquityFlat: number;      // GP azionaria (gp_total - gp_cash) — piatta, in bucket Equity
  commodityFlat: number;     // materie prime — piatte
  cashResidual: number;      // cash + arrotondamenti — piatto
  unparsedBondFlat: number;  // bond senza scadenza → tenuti al valore corrente (bucket bond)
  derivs: DerivInput[];
  bonds: BondInput[];
  unparsedBonds: string[];   // bond senza scadenza deducibile → tenuti piatti
  partialBonds: string[];    // bond con scadenza ma senza cedola → pull-to-par, cedole non modellate
  derivsNoUnderlying: string[];
  derivMVT0: number;         // somma MV derivati a t0 (con segno)
  derivativesNettingT0: number; // valore "netting derivati" signed a t0 (= derivMVT0 se non override)
  equityDerivOffset: number; // (derivativesNettingT0 - derivMVT0): offset costante aggiunto al sleeve equity
  derivSummary: DerivSummaryLeg[]; // dettaglio gambe per UI
  patrimonyT0: number;       // 'all'
  equityT0: number;          // azionario + GP equity + netting derivati a t0
  bondCommodityT0: number;   // bond + commodities a t0
}


export function buildProjectionInputs(
  positions: Position[],
  baseValue: number,
  underlyingPrices?: Record<string, UnderlyingPrice>,
  bondOverrides?: Record<string, ResolvedBondOverride>,
  gpEquityValue: number = 0,
  derivativesNettingT0Override: number | null = null,
): ProjectionInputs {
  const t0 = new Date();
  const fxOf = (p: Position) => (p.exchange_rate && p.exchange_rate > 0 ? p.exchange_rate : 1);
  const upx = (key: string) => underlyingPrices?.[key]?.price ?? 0;

  const derivs: DerivInput[] = [];
  const derivSummary: DerivSummaryLeg[] = [];
  const derivsNoUnderlying: string[] = [];
  const derivKeys = new Set<string>();
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
    const underlyingName = p.underlying || p.description || '';
    const S0 = upx(underlyingName);
    const hasUnderlying = S0 > 0;
    if (!hasUnderlying) derivsNoUnderlying.push(p.description);
    const key = getCanonicalTickerKey({ rawTicker: p.underlying, underlyingName, description: p.description });
    derivKeys.add(key);

    let iv = DEFAULT_OPT_VOL;
    let ivResolved = false;
    if (hasUnderlying && T0 > 0 && anchor > 0) {
      const solved = impliedVolatility(anchor, S0, K, T0, DEFAULT_RATE, p.option_type);
      if (isFinite(solved) && solved > 0) { iv = solved; ivResolved = true; }
    }
    // Correzione di base: il modello a t0 DEVE valere anchor. La differenza residua
    // (solver impreciso, prezzi sotto intrinseco, ecc.) decade linearmente a 0 a scadenza.
    const basisPerShare = (ivResolved && T0 > 0)
      ? anchor - bsPrice(S0, K, T0, DEFAULT_RATE, iv, p.option_type)
      : 0;

    derivs.push({
      description: p.description,
      underlying: underlyingName,
      key,
      type: p.option_type,
      S0, K, T0, iv, ivResolved,
      qtyMult, anchorPerShare: anchor, basisPerShare, hasUnderlying, mvT0,
    });
    derivSummary.push({
      description: p.description,
      underlying: underlyingName,
      type: p.option_type,
      qty,
      strike: K,
      mvT0,
      hasUnderlying,
    });
  }

  const bonds: BondInput[] = [];
  const unparsedBonds: string[] = [];
  const partialBonds: string[] = [];
  let parsedBondMV = 0;       // bond proiettati (sottratti dal flat, riaggiunti via bonds[])
  let unparsedBondFlat = 0;   // bond senza scadenza → bucket bond ma piatti
  let equityFlat = 0;
  const equityByKey: Record<string, number> = {};
  let commodityFlat = 0;

  for (const p of positions) {
    const mvEUR = p.snapshot_market_value ?? p.market_value ?? 0;
    if (p.asset_type === 'bond') {
      const ov = p.isin ? bondOverrides?.[`${p.portfolio_id}::${p.isin}`] : undefined;
      const partial = parseBondPartial(p.description);
      const maturity = ov?.maturityMs != null ? new Date(ov.maturityMs) : partial.maturity;
      const couponRatePct = ov ? ov.couponRatePct : partial.couponRatePct; // override vince (anche null)
      const frequency = ov?.frequency ?? partial.frequency;
      const currentClean = p.snapshot_price ?? p.current_price ?? 0;
      const inflationLinked = partial.inflationLinked;

      // serve la scadenza (per orizzonte/pull-to-par/accredito). Gli indicizzati possono
      // essere proiettati anche senza cedola (accreditano sull'inflazione, no pull-to-par).
      if (maturity && isFinite(maturity.getTime()) && currentClean > 0 && mvEUR !== 0) {
        parsedBondMV += mvEUR;
        if (maturity.getTime() > maxExpiry) maxExpiry = maturity.getTime();
        const info: BondInfo = { couponRatePct: couponRatePct ?? 0, maturity, frequency, parsedFrom: ov ? 'override' : 'auto' };
        const ytm = inflationLinked ? 0 : bondYTM(info, currentClean, t0);
        const couponsModeled = couponRatePct != null && couponRatePct > 0;
        const couponCashPerPeriod = couponsModeled ? (mvEUR * (couponRatePct as number)) / (currentClean * frequency) : 0;

        // Flussi futuri precomputati una volta sola (niente Date math in patrimonyAt).
        const maturityT = Math.max(0, yearFrac(t0, maturity));
        const futureDates = couponDates(info).filter(d => d.getTime() > t0.getTime());
        const cpnPct = (info.couponRatePct / info.frequency); // % del face per periodo
        const flowT: number[] = [];
        const flowAmt: number[] = [];
        for (const d of futureDates) {
          const ft = yearFrac(t0, d);
          const isMat = Math.abs(d.getTime() - maturity.getTime()) < 24 * 3600 * 1000;
          flowT.push(ft);
          flowAmt.push(cpnPct + (isMat ? 100 : 0));
        }
        if (flowT.length === 0) { // scadenza a ridosso: solo rimborso
          flowT.push(maturityT);
          flowAmt.push(100);
        }

        const bTmp: BondInput = {
          description: p.description, info, ytm, mvT0: mvEUR,
          cleanT0Model: 0, couponCashPerPeriod, couponsModeled, inflationLinked,
          maturityT, flowT, flowAmt,
        };
        // Denominatore del ratio = prezzo MODELLO a t0: garantisce ratio(0) = 1, cioè la
        // curva parte esattamente dal MV corrente anche se il solve YTM è ricaduto sul fallback.
        bTmp.cleanT0Model = inflationLinked ? currentClean : bondModelPrice(bTmp, 0, ytm);
        if (!(bTmp.cleanT0Model > 0)) bTmp.cleanT0Model = currentClean;
        bonds.push(bTmp);

        // "parziale" solo se NON indicizzato e cedola sconosciuta (null). ZC (0) è modellato.
        if (!inflationLinked && couponRatePct == null) partialBonds.push(p.description);
      } else {
        unparsedBonds.push(p.description);
        unparsedBondFlat += mvEUR;
      }
    } else if (p.asset_type === 'stock' || p.asset_type === 'etf') {
      // Le azioni/ETF che SONO sottostanti di opzioni in portafoglio condividono lo stesso
      // fattore di shock MC del sottostante: senza questo le covered call risulterebbero
      // "scoperte" nella simulazione (azione e opzione shockate in modo indipendente).
      const key = getCanonicalTickerKey({ rawTicker: p.ticker, rawName: p.description, description: p.description, isin: p.isin });
      if (derivKeys.has(key)) {
        equityByKey[key] = (equityByKey[key] ?? 0) + mvEUR;
      } else {
        equityFlat += mvEUR;
      }
    } else if (p.asset_type === 'commodity') {
      commodityFlat += mvEUR;
    }
  }

  // GP equity (gp_total - gp_cash) viene scorporata dal cashResidual e messa nel bucket Equity.
  const gpEquityFlat = Math.max(0, gpEquityValue);
  const linkedEquity = Object.values(equityByKey).reduce((s, v) => s + v, 0);
  // baseValue = non-derivati a MV + cash (include anche la GP totale). Sottraiamo i bucket espliciti
  // e la quota GP equity; ciò che resta è cash + GP cash + arrotondamenti.
  const cashResidual = baseValue - parsedBondMV - unparsedBondFlat - equityFlat - linkedEquity - commodityFlat - gpEquityFlat;

  const horizon = maxExpiry > 0 ? new Date(maxExpiry) : new Date(t0.getTime() + MS_YEAR);

  const derivMVT0 = derivs.reduce((s, d) => s + d.mvT0, 0);
  const derivativesNettingT0 = derivativesNettingT0Override ?? derivMVT0;
  const equityDerivOffset = derivativesNettingT0 - derivMVT0;
  const parsedBondT0 = bonds.reduce((s, b) => s + b.mvT0, 0);
  const patrimonyT0 = baseValue + derivativesNettingT0;
  const equityT0 = equityFlat + linkedEquity + gpEquityFlat + derivativesNettingT0;
  const bondCommodityT0 = parsedBondT0 + unparsedBondFlat + commodityFlat;

  return {
    t0, horizon,
    equityFlat, equityByKey, gpEquityFlat, commodityFlat, cashResidual, unparsedBondFlat,
    derivs, bonds, unparsedBonds, partialBonds, derivsNoUnderlying,
    derivMVT0, derivativesNettingT0, equityDerivOffset, derivSummary,
    patrimonyT0, equityT0, bondCommodityT0,
  };
}

// ───────────────────────── Time grid ─────────────────────────

export interface TimePoint { date: Date; tYears: number; label: string; }

const MONTHS_IT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

function labelOf(d: Date): string {
  return `${MONTHS_IT[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`;
}

/**
 * Punti mensili da t0 a horizon (incluso), monotoni e mai oltre l'orizzonte;
 * se l'orizzonte è lungo, dirada per non superare maxPoints.
 */
export function buildTimeGrid(t0: Date, horizon: Date, maxPoints = 60): TimePoint[] {
  const totalMonths = Math.max(1, Math.ceil(yearFrac(t0, horizon) * 12));
  const step = Math.max(1, Math.ceil(totalMonths / maxPoints));
  const points: TimePoint[] = [];
  for (let m = 0; ; m += step) {
    const d = new Date(Date.UTC(t0.getUTCFullYear(), t0.getUTCMonth() + m, t0.getUTCDate()));
    if (d.getTime() >= horizon.getTime()) break; // l'orizzonte viene aggiunto sotto, esatto
    points.push({ date: d, tYears: Math.max(0, yearFrac(t0, d)), label: labelOf(d) });
    if (points.length > maxPoints + 2) break; // guardia
  }
  points.push({ date: horizon, tYears: Math.max(0, yearFrac(t0, horizon)), label: labelOf(horizon) });
  return points;
}

// ───────────────────────── Shock set ─────────────────────────

export interface ShockSet {
  volMult: number;     // moltiplicatore IV (1 = invariata)
  rateBump: number;    // +/- assoluto su tassi (es. 0.01 = +100bp)
  equityMult: number;  // moltiplicatore prezzi azioni/ETF aggregate (1 = invariato)
  underlyingMult: Record<string, number>; // override per ticker canonico (MC titoli)
}

const NO_SHOCK: ShockSet = { volMult: 1, rateBump: 0, equityMult: 1, underlyingMult: {} };

/** Valore patrimonio a una data sotto un set di shock. */
function patrimonyAt(inp: ProjectionInputs, tp: TimePoint, sh: ShockSet, scope: ProjectionScope = 'all'): number {
  const r = DEFAULT_RATE + sh.rateBump;

  // ── bucket EQUITY: azioni/ETF (shockabili) + derivati (decadimento + esercizio) ──
  let derivVal = 0;
  let equityAdjAtExpiry = 0; // P/L da esercizio: spostato dal bucket derivati al bucket equity
  for (const d of inp.derivs) {
    if (!d.hasUnderlying) {
      // Senza prezzo sottostante: decadimento lineare del MV verso 0 sulla vita residua.
      const frac = d.T0 > 0 ? Math.max(0, (d.T0 - tp.tYears) / d.T0) : 0;
      derivVal += d.mvT0 * frac;
      continue;
    }
    if (d.T0 <= 0) {
      // Opzione già scaduta nello snapshot (dato stantio): tenuta al MV corrente per non
      // disancorare t0 (l'esercizio con l'intrinseco creerebbe un salto artificiale).
      derivVal += d.mvT0;
      continue;
    }
    const Tt = Math.max(0, d.T0 - tp.tYears);
    const sMult = sh.underlyingMult[d.key] ?? sh.equityMult;
    const S = d.S0 * sMult;
    const expired = tp.tYears >= d.T0;
    if (expired) {
      // Esercizio a scadenza: il P/L intrinseco si materializza nel bucket equity (azioni
      // consegnate/acquistate al strike). Il bucket derivati si azzera.
      const intrinsic = d.type === 'call' ? Math.max(0, S - d.K) : Math.max(0, d.K - S);
      equityAdjAtExpiry += intrinsic * d.qtyMult;
    } else if (d.ivResolved) {
      // BS + basis: la correzione decade linearmente a 0 → a t0 il valore è ESATTAMENTE
      // il MV corrente, a scadenza è l'intrinseco puro.
      const basis = d.basisPerShare * (Tt / d.T0);
      derivVal += (bsPrice(S, d.K, Tt, r, d.iv * sh.volMult, d.type) + basis) * d.qtyMult;
    } else {
      // Interpolazione lineare prezzo corrente → intrinseco a scadenza. NIENTE clamp sul
      // premio temporale: per quote sotto l'intrinseco (deep ITM) il clamp disancorerebbe t0.
      const intrinsic = d.type === 'call' ? Math.max(0, S - d.K) : Math.max(0, d.K - S);
      const frac = Tt / d.T0;
      const px = intrinsic + (d.anchorPerShare - intrinsic) * frac;
      derivVal += px * d.qtyMult;
    }
  }
  let linkedEquityVal = 0;
  for (const key in inp.equityByKey) {
    linkedEquityVal += inp.equityByKey[key] * (sh.underlyingMult[key] ?? sh.equityMult);
  }
  const equitySleeve = inp.equityFlat * sh.equityMult + linkedEquityVal + inp.gpEquityFlat + derivVal + equityAdjAtExpiry + inp.equityDerivOffset;

  // ── bucket BOND + COMMODITY ──
  let bondVal = 0;
  let coupons = 0;
  for (const b of inp.bonds) {
    const tCapYears = Math.min(tp.tYears, b.maturityT);
    if (b.inflationLinked) {
      // NON converge a 100: accredita sul target inflazione BCE (shockabile dai tassi).
      const inflation = Math.max(0, INFLATION_TARGET + sh.rateBump);
      bondVal += b.mvT0 * Math.pow(1 + inflation, tCapYears);
    } else if (tp.tYears >= b.maturityT) {
      bondVal += b.mvT0 * (100 / b.cleanT0Model); // rimborso a par
    } else {
      const clean = bondModelPrice(b, tp.tYears, b.ytm + sh.rateBump);
      bondVal += b.mvT0 * (clean / b.cleanT0Model);
    }
    // cedole staccate in (t0, tp] — flussi precomputati, niente Date math
    if (b.couponCashPerPeriod !== 0) {
      let n = 0;
      for (let i = 0; i < b.flowT.length; i++) {
        if (b.flowT[i] <= tp.tYears) n++;
      }
      coupons += n * b.couponCashPerPeriod;
    }
  }
  const bondCommoditySleeve = bondVal + coupons + inp.unparsedBondFlat + inp.commodityFlat;

  if (scope === 'equity') return equitySleeve;
  if (scope === 'bond_commodity') return bondCommoditySleeve;
  return equitySleeve + bondCommoditySleeve + inp.cashResidual;
}

function baseForScope(inp: ProjectionInputs, scope: ProjectionScope): number {
  if (scope === 'equity') return inp.equityT0;
  if (scope === 'bond_commodity') return inp.bondCommodityT0;
  return inp.patrimonyT0;
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

export function projectDeterministic(inp: ProjectionInputs, grid: TimePoint[], scope: ProjectionScope = 'all'): ProjectionRow[] {
  const base = baseForScope(inp, scope);
  return grid.map(tp => {
    const v = patrimonyAt(inp, tp, NO_SHOCK, scope);
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

/** Per ogni punto temporale calcola p5/p50/p95 del patrimonio simulando shock correlati. */
export function projectMonteCarlo(
  inp: ProjectionInputs,
  grid: TimePoint[],
  cfg: MonteCarloConfig,
  scope: ProjectionScope = 'all',
): ProjectionRow[] {
  const rand = mulberry32(0xC0FFEE);
  const base = baseForScope(inp, scope);
  // chiavi canoniche: sottostanti dei derivati + azioni ad essi associate
  const keys = Array.from(new Set([
    ...inp.derivs.map(d => d.key),
    ...Object.keys(inp.equityByKey),
  ].filter(Boolean)));
  // vol per sottostante: IV media dei derivati su quel ticker, fallback vol azionaria
  const sigmaByKey: Record<string, number> = {};
  for (const k of keys) {
    const legs = inp.derivs.filter(d => d.key === k && d.ivResolved);
    sigmaByKey[k] = legs.length > 0
      ? legs.reduce((s, d) => s + d.iv, 0) / legs.length
      : DEFAULT_EQUITY_VOL;
  }

  // matrice [point][path]
  const samples: number[][] = grid.map(() => []);
  const rho = MC_MARKET_CORR;
  const rhoOrth = Math.sqrt(1 - rho * rho);

  for (let p = 0; p < cfg.paths; p++) {
    // shock costanti per path (vol/tassi); browniani correlati per i sottostanti (titoli):
    // Z_u = ρ·Zm + √(1−ρ²)·ε_u, con Zm fattore di mercato condiviso con l'equity aggregata.
    const volMult = cfg.enableVolRates ? Math.max(0.05, 1 + cfg.volSigma * gauss(rand)) : 1;
    const rateBump = cfg.enableVolRates ? cfg.rateSigma * gauss(rand) : 0;

    const zMarket = gauss(rand);
    const uZ: Record<string, number> = {};
    keys.forEach(k => { uZ[k] = rho * zMarket + rhoOrth * gauss(rand); });

    for (let i = 0; i < grid.length; i++) {
      const tp = grid[i];
      let underlyingMult: Record<string, number> = {};
      let equityMult = 1;
      if (cfg.enableUnderlying) {
        const t = Math.max(0, tp.tYears);
        const sq = Math.sqrt(t);
        underlyingMult = {};
        keys.forEach(k => {
          const sigma = sigmaByKey[k];
          underlyingMult[k] = Math.exp((DEFAULT_RATE - 0.5 * sigma * sigma) * t + sigma * sq * uZ[k]);
        });
        equityMult = Math.exp((DEFAULT_RATE - 0.5 * DEFAULT_EQUITY_VOL * DEFAULT_EQUITY_VOL) * t + DEFAULT_EQUITY_VOL * sq * zMarket);
      }
      const sh: ShockSet = { volMult, rateBump, equityMult, underlyingMult };
      samples[i].push(patrimonyAt(inp, tp, sh, scope));
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
