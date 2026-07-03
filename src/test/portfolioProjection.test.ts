import { describe, it, expect } from 'vitest';
import { parseBondInfo, bondYTM, bondCleanPrice } from '@/lib/bondMath';
import {
  buildProjectionInputs, buildTimeGrid, projectDeterministic,
} from '@/lib/portfolioProjection';
import { Position } from '@/types/portfolio';

function pos(p: Partial<Position>): Position {
  return {
    id: Math.random().toString(36).slice(2),
    portfolio_id: 'pf1',
    isin: null, ticker: null, description: '', asset_type: 'stock',
    currency: 'EUR', exchange_rate: 1, quantity: 0,
    current_price: null, avg_cost: null, market_value: null,
    profit_loss: null, profit_loss_pct: null, weight_pct: null,
    option_type: null, strike_price: null, expiry_date: null, underlying: null,
    snapshot_price: null, snapshot_market_value: null,
    created_at: '', updated_at: '',
    ...p,
  };
}

describe('bondMath.parseBondInfo', () => {
  it('estrae cedola e scadenza DD/MM/YYYY', () => {
    const b = parseBondInfo('OB. BTP 3.50% 01/03/2032');
    expect(b).not.toBeNull();
    expect(b!.couponRatePct).toBeCloseTo(3.5);
    expect(b!.maturity.getUTCFullYear()).toBe(2032);
    expect(b!.maturity.getUTCMonth()).toBe(2); // marzo
  });

  it('gestisce mese italiano a 2 lettere e virgola decimale', () => {
    const b = parseBondInfo('BTPS 0,95% 15DC30');
    expect(b).not.toBeNull();
    expect(b!.couponRatePct).toBeCloseTo(0.95);
    expect(b!.maturity.getUTCFullYear()).toBe(2030);
    expect(b!.maturity.getUTCMonth()).toBe(11); // dicembre
  });

  it('ritorna null se mancano dati', () => {
    expect(parseBondInfo('OBBLIGAZIONE SENZA DATI')).toBeNull();
  });
});

describe('bondMath pricing', () => {
  it('YTM riproduce il prezzo e converge a par a scadenza', () => {
    const info = parseBondInfo('BOND 3% 31/12/2030')!;
    const asOf = new Date(Date.UTC(2026, 0, 1));
    const price = 95;
    const ytm = bondYTM(info, price, asOf);
    expect(bondCleanPrice(info, ytm, asOf)).toBeCloseTo(price, 1);
    // un giorno prima della scadenza il clean price ~ 100 (solo ultimo flusso, scontato pochissimo)
    const nearMat = new Date(Date.UTC(2030, 11, 30));
    expect(bondCleanPrice(info, ytm, nearMat)).toBeGreaterThan(99);
  });
});

describe('portfolioProjection', () => {
  const underlyingPrices = { AAA: { price: 120, currency: 'USD', updated_at: '' } } as any;

  it('il primo punto eguaglia il patrimonio a t0 (netting totale)', () => {
    const positions = [
      pos({ asset_type: 'stock', market_value: 100000, snapshot_market_value: 100000 }),
      pos({ asset_type: 'derivative', option_type: 'call', quantity: -5, strike_price: 100,
        expiry_date: new Date(Date.now() + 200 * 86400000).toISOString().slice(0, 10),
        underlying: 'AAA', current_price: 25, snapshot_price: 25, exchange_rate: 1 }),
    ];
    const baseValue = 100000; // stock; il derivato entra via netting
    const inp = buildProjectionInputs(positions, baseValue, underlyingPrices);
    const grid = buildTimeGrid(inp.t0, inp.horizon, 60);
    const det = projectDeterministic(inp, grid);
    // patrimonyT0 = base + MV derivati = 100000 + (25 * -5 * 100) = 100000 - 12500
    expect(inp.patrimonyT0).toBeCloseTo(87500, 0);
    expect(det[0].patrimony).toBeCloseTo(inp.patrimonyT0, -1);
    expect(det[0].pnlPct).toBeCloseTo(0, 5);
  });

  it('la CALL venduta ITM converge al valore intrinseco a scadenza (premio temporale → 0)', () => {
    const positions = [
      pos({ asset_type: 'derivative', option_type: 'call', quantity: -5, strike_price: 100,
        expiry_date: new Date(Date.now() + 200 * 86400000).toISOString().slice(0, 10),
        underlying: 'AAA', current_price: 25, snapshot_price: 25, exchange_rate: 1 }),
    ];
    const inp = buildProjectionInputs(positions, 0, underlyingPrices);
    const grid = buildTimeGrid(inp.t0, inp.horizon, 60);
    const det = projectDeterministic(inp, grid);
    // a scadenza: intrinseco = (120-100) = 20/azione -> MV = 20 * -5 * 100 = -10000
    const lastVal = det[det.length - 1].patrimony;
    expect(lastVal).toBeCloseTo(-10000, -1);
  });

  it('i bond convergono a par e le cedole incrementano il patrimonio', () => {
    const positions = [
      pos({ asset_type: 'bond', description: 'BOND 4% 31/12/2030',
        snapshot_price: 95, current_price: 95, snapshot_market_value: 95000, market_value: 95000 }),
    ];
    const baseValue = 95000;
    const inp = buildProjectionInputs(positions, baseValue, underlyingPrices);
    const grid = buildTimeGrid(inp.t0, inp.horizon, 60);
    const det = projectDeterministic(inp, grid);
    // alla fine: rimborso a par (95000 * 100/95 = 100000) + cedole accumulate (>0)
    const last = det[det.length - 1].patrimony;
    expect(last).toBeGreaterThan(100000); // par + almeno qualche cedola
    expect(det[det.length - 1].pnlPct).toBeGreaterThan(0);
  });
});

import { parseBondPartial } from '@/lib/bondMath';

describe('bondMath.parseBondPartial (formati BTP reali)', () => {
  it('BTP TF 2,45% ST33 EUR → cedola 2.45, settembre 2033, semestrale', () => {
    const b = parseBondPartial('BTP TF 2,45% ST33 EUR');
    expect(b.couponRatePct).toBeCloseTo(2.45);
    expect(b.maturity?.getUTCFullYear()).toBe(2033);
    expect(b.maturity?.getUTCMonth()).toBe(8); // settembre
    expect(b.frequency).toBe(2);
  });
  it('BTP ITA 28062030 (data concatenata) → scadenza ok, cedola non deducibile', () => {
    const b = parseBondPartial('BTP ITA 28062030 INFL CUM ASS');
    expect(b.couponRatePct).toBeNull();
    expect(b.maturity?.getUTCFullYear()).toBe(2030);
    expect(b.maturity?.getUTCMonth()).toBe(5); // giugno
  });
  it('BTP VALORE 05/03/2030 ST UP CUM → scadenza ok, cedola step-up non deducibile', () => {
    const b = parseBondPartial('BTP VALORE 05/03/2030 ST UP CUM');
    expect(b.couponRatePct).toBeNull();
    expect(b.maturity?.getUTCFullYear()).toBe(2030);
    expect(b.maturity?.getUTCMonth()).toBe(2); // marzo
  });
});

describe('portfolioProjection: regressione bond non proiettabili', () => {
  it('un bond senza scadenza deducibile resta nel patrimonio (non sparisce)', () => {
    const positions = [
      pos({ asset_type: 'stock', market_value: 1_000_000, snapshot_market_value: 1_000_000 }),
      // niente scadenza/cedola deducibili → deve restare piatto, NON essere sottratto
      pos({ asset_type: 'bond', isin: 'IT000NODATA', description: 'OBBLIGAZIONE STRANA SENZA DATI',
        snapshot_price: 99, current_price: 99, snapshot_market_value: 3_000_000, market_value: 3_000_000 }),
    ];
    const baseValue = 4_000_000; // stock 1M + bond 3M
    const inp = buildProjectionInputs(positions, baseValue);
    const grid = buildTimeGrid(inp.t0, inp.horizon, 60);
    const det = projectDeterministic(inp, grid);
    expect(inp.unparsedBonds.length).toBe(1);
    // il patrimonio a t0 deve essere ~4M, non 1M
    expect(det[0].patrimony).toBeCloseTo(4_000_000, -2);
  });
});

describe('bondMath.parseBondPartial — BOT ZC e indicizzati', () => {
  it('BOT ZC JUN27 → cedola 0 (nota), scadenza giu 2027, non indicizzato', () => {
    const b = parseBondPartial('BOT ZC (zero coupon) JUN27');
    expect(b.couponRatePct).toBe(0);
    expect(b.maturity?.getUTCFullYear()).toBe(2027);
    expect(b.maturity?.getUTCMonth()).toBe(5); // giugno
    expect(b.inflationLinked).toBe(false);
  });
  it('BTP ITA INFL → riconosciuto come indicizzato all\'inflazione', () => {
    expect(parseBondPartial('BTP ITA 28062030 INFL ORD').inflationLinked).toBe(true);
  });
});

describe('portfolioProjection — ZC e indicizzati', () => {
  const up = {} as any;
  const inDays = (days: number) => new Date(Date.now() + days * 86400000);
  const ddmmyyyy = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;

  it('BOT ZC converge a par e NON è segnalato come parziale', () => {
    const mat = inDays(365);
    const positions = [
      pos({ asset_type: 'bond', isin: 'IT000BOT', description: `BOT ZC ${ddmmyyyy(mat)}`,
        snapshot_price: 97, current_price: 97, snapshot_market_value: 97000, market_value: 97000 }),
    ];
    const inp = buildProjectionInputs(positions, 97000, up);
    const grid = buildTimeGrid(inp.t0, inp.horizon, 60);
    const det = projectDeterministic(inp, grid);
    expect(inp.partialBonds.length).toBe(0); // ZC è modellato, non "senza cedola"
    expect(det[det.length - 1].patrimony).toBeCloseTo(100000, -2); // par
  });

  it('BTP indicizzato NON converge a 100: accredita ~2%/anno', () => {
    const mat = inDays(Math.round(5 * 365.25));
    const positions = [
      pos({ asset_type: 'bond', isin: 'IT000INFL', description: `BTP ITA INFL ${ddmmyyyy(mat)}`,
        snapshot_price: 100, current_price: 100, snapshot_market_value: 100000, market_value: 100000 }),
    ];
    const inp = buildProjectionInputs(positions, 100000, up);
    const grid = buildTimeGrid(inp.t0, inp.horizon, 60);
    const det = projectDeterministic(inp, grid);
    const last = det[det.length - 1].patrimony;
    // a prezzo 100 il pull-to-par darebbe 100000 (piatto); l'accredito inflazione dà ~100000*1.02^5
    expect(last).toBeGreaterThan(108000);
    expect(last).toBeLessThan(113000);
  });

  it('scope: equity isola azionario+derivati, bond_commodity isola bond', () => {
    const mat = inDays(365);
    const positions = [
      pos({ asset_type: 'stock', market_value: 200000, snapshot_market_value: 200000 }),
      pos({ asset_type: 'bond', isin: 'IT000BOT2', description: `BOT ZC ${ddmmyyyy(mat)}`,
        snapshot_price: 98, current_price: 98, snapshot_market_value: 98000, market_value: 98000 }),
    ];
    const inp = buildProjectionInputs(positions, 298000, up);
    const grid = buildTimeGrid(inp.t0, inp.horizon, 60);
    const eq = projectDeterministic(inp, grid, 'equity');
    const bc = projectDeterministic(inp, grid, 'bond_commodity');
    expect(eq[0].patrimony).toBeCloseTo(200000, -2);   // solo azionario
    expect(bc[0].patrimony).toBeCloseTo(98000, -2);     // solo bond
    expect(bc[bc.length - 1].patrimony).toBeCloseTo(100000, -2); // bond a par
  });
});

// ─────────────── Fix: ancoraggio a t0, griglia monotona, MC coerente ───────────────
import { projectMonteCarlo, DEFAULT_MC } from '@/lib/portfolioProjection';

describe('ancoraggio a t0 (P/L parte da 0%)', () => {
  it('resta ancorato anche con opzione deep ITM prezzata sotto intrinseco (IV non risolvibile)', () => {
    // AAA spot 120; call strike 20 quotata 98 < intrinseco 100 → solver IV fallisce
    const positions = [
      pos({ asset_type: 'stock', market_value: 50000, snapshot_market_value: 50000, description: 'ALTRO TITOLO' }),
      pos({ asset_type: 'derivative', option_type: 'call', quantity: -2, strike_price: 20,
        expiry_date: new Date(Date.now() + 300 * 86400000).toISOString().slice(0, 10),
        underlying: 'AAA', current_price: 98, snapshot_price: 98, exchange_rate: 1 }),
    ];
    const underlyingPrices = { AAA: { price: 120, currency: 'USD' } } as any;
    const inp = buildProjectionInputs(positions, 50000, underlyingPrices);
    const grid = buildTimeGrid(inp.t0, inp.horizon, 60);
    const det = projectDeterministic(inp, grid);
    expect(det[0].patrimony).toBeCloseTo(inp.patrimonyT0, 4);
    expect(det[0].pnlPct).toBeCloseTo(0, 6);
  });

  it('resta ancorato con opzione già scaduta nello snapshot (T0 = 0)', () => {
    const positions = [
      pos({ asset_type: 'derivative', option_type: 'put', quantity: -1, strike_price: 150,
        expiry_date: new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10), // scaduta
        underlying: 'AAA', current_price: 31, snapshot_price: 31, exchange_rate: 1 }),
      pos({ asset_type: 'derivative', option_type: 'call', quantity: -1, strike_price: 100,
        expiry_date: new Date(Date.now() + 100 * 86400000).toISOString().slice(0, 10),
        underlying: 'AAA', current_price: 25, snapshot_price: 25, exchange_rate: 1 }),
    ];
    const underlyingPrices = { AAA: { price: 120, currency: 'USD' } } as any;
    const inp = buildProjectionInputs(positions, 0, underlyingPrices);
    const grid = buildTimeGrid(inp.t0, inp.horizon, 60);
    const det = projectDeterministic(inp, grid);
    expect(det[0].patrimony).toBeCloseTo(inp.patrimonyT0, 4);
  });

  it('bond: la curva parte esattamente dal MV corrente (ratio normalizzato sul modello)', () => {
    const positions = [
      pos({ asset_type: 'bond', description: 'BOND 4% 31/12/2030',
        snapshot_price: 95, current_price: 95, snapshot_market_value: 95000, market_value: 95000 }),
    ];
    const inp = buildProjectionInputs(positions, 95000, { } as any);
    const grid = buildTimeGrid(inp.t0, inp.horizon, 60);
    const det = projectDeterministic(inp, grid);
    expect(det[0].patrimony).toBeCloseTo(95000, 0);
    expect(det[0].pnlPct).toBeCloseTo(0, 5);
  });
});

describe('buildTimeGrid', () => {
  it('è monotona, non supera l\'orizzonte e termina esattamente sull\'orizzonte', () => {
    const t0 = new Date(Date.UTC(2026, 6, 3));
    const horizon = new Date(Date.UTC(2031, 8, 17)); // ~5.2 anni → step > 1
    const grid = buildTimeGrid(t0, horizon, 60);
    for (let i = 1; i < grid.length; i++) {
      expect(grid[i].date.getTime()).toBeGreaterThan(grid[i - 1].date.getTime());
    }
    expect(grid[0].tYears).toBe(0);
    expect(grid[grid.length - 1].date.getTime()).toBe(horizon.getTime());
    expect(grid.length).toBeLessThanOrEqual(63);
  });
});

describe('Monte Carlo titoli — coerenza covered call', () => {
  it('l\'upside di una covered call resta limitato dallo strike (azione e opzione condividono lo shock)', () => {
    // 1000 azioni AAA @120 (MV 120k) + 10 call vendute K=130 → payoff a scadenza cap ≈ 130k
    const expiryDays = 365;
    const positions = [
      pos({ asset_type: 'stock', description: 'AAA CORP', ticker: 'AAA',
        market_value: 120000, snapshot_market_value: 120000 }),
      pos({ asset_type: 'derivative', option_type: 'call', quantity: -10, strike_price: 130,
        expiry_date: new Date(Date.now() + expiryDays * 86400000).toISOString().slice(0, 10),
        underlying: 'AAA', current_price: 8, snapshot_price: 8, exchange_rate: 1 }),
    ];
    const underlyingPrices = { AAA: { price: 120, currency: 'USD' } } as any;
    const inp = buildProjectionInputs(positions, 120000, underlyingPrices);
    // l'azione è agganciata al sottostante dell'opzione
    expect(Object.values(inp.equityByKey).reduce((s, v) => s + v, 0)).toBeCloseTo(120000, 0);
    expect(inp.equityFlat).toBeCloseTo(0, 0);

    const grid = buildTimeGrid(inp.t0, inp.horizon, 24);
    const mc = projectMonteCarlo(inp, grid, { ...DEFAULT_MC, enableVolRates: false, enableUnderlying: true, paths: 200 });
    const lastP95 = mc[mc.length - 1].p95!;
    // cap teorico: 1000 azioni consegnate a 130 = 130.000 (+ tolleranza per drift/percentile discreto)
    expect(lastP95).toBeLessThanOrEqual(133000);
  });
});
