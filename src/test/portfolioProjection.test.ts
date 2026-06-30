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
