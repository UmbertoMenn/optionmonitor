import { describe, it, expect } from 'vitest';
import { calculateSyntheticCcDrccRisk } from '@/lib/riskCalculator';
import { calculateUniversalMaxLoss, positionsToLegs } from '@/lib/universalMaxLoss';
import { Position } from '@/types/portfolio';
import { CoveredCallPosition, DeRiskingCoveredCallPosition } from '@/lib/derivativeStrategies';

function pos(p: Partial<Position>): Position {
  return {
    id: Math.random().toString(36).slice(2),
    portfolio_id: 'pf1',
    isin: null, ticker: null, description: '', asset_type: 'stock',
    currency: 'USD', exchange_rate: 1, quantity: 0,
    current_price: null, avg_cost: null, market_value: null,
    profit_loss: null, profit_loss_pct: null, weight_pct: null,
    option_type: null, strike_price: null, expiry_date: null, underlying: null,
    snapshot_price: null, snapshot_market_value: null,
    created_at: '', updated_at: '',
    ...p,
  };
}

describe('calculateSyntheticCcDrccRisk — warning PMC mancante (CC sintetica Long CALL ITM)', () => {
  it('spot > strike short call, PMC presente: nessun warning, rischio = PMC × qty × 100', () => {
    const shortCall = pos({
      asset_type: 'derivative', option_type: 'call', quantity: -5,
      strike_price: 200, underlying: 'TEST', ticker: 'TEST', current_price: 50,
    });
    const longCall = pos({
      asset_type: 'derivative', option_type: 'call', quantity: 5,
      strike_price: 100, underlying: 'TEST', ticker: 'TEST',
      current_price: 150, avg_cost: 80,
    });
    const cc: CoveredCallPosition = {
      option: shortCall, underlying: shortCall, contractsCovered: 5, sharesCovered: 500,
      isFullyCovered: true, isSynthetic: true, syntheticCall: longCall,
    };
    const spotResolver = () => ({ spot: 250, source: 'portfolio' as const, tickerUsed: 'TEST' });

    const [d] = calculateSyntheticCcDrccRisk([cc], [], spotResolver);

    expect(d.syntheticBreakdown?.priceSource).toBe('PMC');
    expect(d.syntheticBreakdown?.pmcMissing).toBe(false);
    expect(d.riskOriginal).toBeCloseTo(80 * 5 * 100, 0); // PMC × qty × 100
    expect(d.composition).not.toContain('PMC MANCANTE');
  });

  it('spot > strike short call, PMC MANCANTE: warning attivo, rischio silenziosamente 0 (da correggere quando torna il PMC)', () => {
    const shortCall = pos({
      asset_type: 'derivative', option_type: 'call', quantity: -5,
      strike_price: 200, underlying: 'TEST', ticker: 'TEST', current_price: 50,
    });
    const longCall = pos({
      asset_type: 'derivative', option_type: 'call', quantity: 5,
      strike_price: 100, underlying: 'TEST', ticker: 'TEST',
      current_price: 150, avg_cost: null, // <-- PMC mancante (nuovo flusso CSV)
    });
    const cc: CoveredCallPosition = {
      option: shortCall, underlying: shortCall, contractsCovered: 5, sharesCovered: 500,
      isFullyCovered: true, isSynthetic: true, syntheticCall: longCall,
    };
    const spotResolver = () => ({ spot: 250, source: 'portfolio' as const, tickerUsed: 'TEST' });

    const [d] = calculateSyntheticCcDrccRisk([cc], [], spotResolver);

    expect(d.syntheticBreakdown?.priceSource).toBe('PMC');
    expect(d.syntheticBreakdown?.pmcMissing).toBe(true);
    expect(d.riskOriginal).toBe(0); // bug noto finché manca il PMC: warning serve a segnalarlo
    expect(d.composition).toContain('PMC MANCANTE');
  });

  it('spot <= strike short call, PMC mancante: NESSUN warning (si usa il prezzo di mercato, non il PMC)', () => {
    const shortCall = pos({
      asset_type: 'derivative', option_type: 'call', quantity: -5,
      strike_price: 200, underlying: 'TEST', ticker: 'TEST', current_price: 50,
    });
    const longCall = pos({
      asset_type: 'derivative', option_type: 'call', quantity: 5,
      strike_price: 100, underlying: 'TEST', ticker: 'TEST',
      current_price: 150, avg_cost: null,
    });
    const cc: CoveredCallPosition = {
      option: shortCall, underlying: shortCall, contractsCovered: 5, sharesCovered: 500,
      isFullyCovered: true, isSynthetic: true, syntheticCall: longCall,
    };
    // spot sotto lo strike della short call -> ramo "mkt", il PMC non serve
    const spotResolver = () => ({ spot: 150, source: 'portfolio' as const, tickerUsed: 'TEST' });

    const [d] = calculateSyntheticCcDrccRisk([cc], [], spotResolver);

    expect(d.syntheticBreakdown?.priceSource).toBe('mkt');
    expect(d.syntheticBreakdown?.pmcMissing).toBe(false);
    expect(d.riskOriginal).toBeCloseTo(150 * 5 * 100, 0); // current_price × qty × 100
  });

  it('DR-CC sintetica (Long CALL ITM + Short CALL + Protezione PUT), spot ITM, PMC mancante: warning attivo', () => {
    const shortCall = pos({
      asset_type: 'derivative', option_type: 'call', quantity: -3,
      strike_price: 300, underlying: 'MU', ticker: 'MU', current_price: 20,
    });
    const longCall = pos({
      asset_type: 'derivative', option_type: 'call', quantity: 3,
      strike_price: 150, underlying: 'MU', ticker: 'MU',
      current_price: 200, avg_cost: null,
    });
    const protPut = pos({
      asset_type: 'derivative', option_type: 'put', quantity: 3,
      strike_price: 250, underlying: 'MU', ticker: 'MU', current_price: 5,
    });
    const dr: DeRiskingCoveredCallPosition = {
      coveredCall: { option: shortCall, underlying: shortCall, contractsCovered: 3, sharesCovered: 300,
        isFullyCovered: true, isSynthetic: true },
      protectionPut: protPut, isSynthetic: true, syntheticCall: longCall,
    };
    const spotResolver = () => ({ spot: 400, source: 'portfolio' as const, tickerUsed: 'MU' });

    const [d] = calculateSyntheticCcDrccRisk([], [dr], spotResolver);

    expect(d.syntheticBreakdown?.pmcMissing).toBe(true);
    expect(d.riskOriginal).toBe(0);
  });
});

describe('positionsToLegs / calculateUniversalMaxLoss — warning PMC mancante (strategie multi-gamba)', () => {
  it('nessuna gamba con PMC mancante -> anyPmcMissing = false', () => {
    const legs = positionsToLegs([
      pos({ asset_type: 'derivative', option_type: 'put', quantity: -1, strike_price: 90, avg_cost: 2 }),
      pos({ asset_type: 'derivative', option_type: 'put', quantity: 1, strike_price: 80, avg_cost: 0.5 }),
    ]);
    const result = calculateUniversalMaxLoss(legs);
    expect(result.anyPmcMissing).toBe(false);
  });

  it('una gamba con PMC mancante (avg_cost null) -> anyPmcMissing = true', () => {
    const legs = positionsToLegs([
      pos({ asset_type: 'derivative', option_type: 'put', quantity: -1, strike_price: 90, avg_cost: null }),
      pos({ asset_type: 'derivative', option_type: 'put', quantity: 1, strike_price: 80, avg_cost: 0.5 }),
    ]);
    const result = calculateUniversalMaxLoss(legs);
    expect(result.anyPmcMissing).toBe(true);
    // Il premio netto della gamba con PMC mancante è trattato come 0 -> max loss non affidabile
  });

  it('PMC=0 esplicito (non null) NON viene marcato come mancante', () => {
    const legs = positionsToLegs([
      pos({ asset_type: 'derivative', option_type: 'put', quantity: -1, strike_price: 90, avg_cost: 0 }),
    ]);
    expect(legs[0].pmcMissing).toBe(false);
  });

  it('short strangle con PMC mancante -> anyPmcMissing = true anche nel ramo speciale', () => {
    const legs = positionsToLegs([
      pos({ asset_type: 'derivative', option_type: 'put', quantity: -1, strike_price: 90, avg_cost: null }),
      pos({ asset_type: 'derivative', option_type: 'call', quantity: -1, strike_price: 110, avg_cost: 3 }),
    ]);
    const result = calculateUniversalMaxLoss(legs);
    expect(result.anyPmcMissing).toBe(true);
  });
});
