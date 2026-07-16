import { describe, it, expect } from 'vitest';
import { autoClassify, buildConfigsFromStrategies } from '@/components/derivatives/StrategyConfigWizard';
import { Position } from '@/types/portfolio';

function pos(p: Partial<Position>): Position {
  return {
    id: Math.random().toString(36).slice(2),
    portfolio_id: 'pf1',
    isin: null, ticker: null, description: '', asset_type: 'derivative',
    currency: 'USD', exchange_rate: 1, quantity: 0,
    current_price: null, avg_cost: null, market_value: null,
    profit_loss: null, profit_loss_pct: null, weight_pct: null,
    option_type: null, strike_price: null, expiry_date: null, underlying: null,
    snapshot_price: null, snapshot_market_value: null,
    created_at: '', updated_at: '',
    ...p,
  };
}

describe('Wizard — identità canonica unica (ADBE, CRDO, MBG)', () => {
  it('ADBE: azione ADOBE INC + short call underlying=ADBE = un solo gruppo Covered Call', () => {
    const stock = pos({
      asset_type: 'stock', ticker: 'ADBE', isin: 'US00724F1012',
      description: 'ADOBE INC', quantity: 100, current_price: 550,
    });
    const shortCall = pos({
      asset_type: 'derivative', option_type: 'call', quantity: -1,
      underlying: 'ADBE', description: 'ADBE CALL 600 DEC25',
      strike_price: 600, expiry_date: '2025-12-19',
    });
    const strategies = autoClassify([shortCall], [stock, shortCall]);
    expect(strategies.length).toBe(1);
    expect(strategies[0].strategyType).toBe('covered_call');
    const configs = buildConfigsFromStrategies(strategies);
    expect(configs[0].underlying).toBe('ADBE');
  });

  it('ADBE: stock + short call (CC) + long call LEAP separata = 2 strategie, tutte sotto ADBE', () => {
    const stock = pos({
      asset_type: 'stock', ticker: 'ADBE', isin: 'US00724F1012',
      description: 'ADOBE INC', quantity: 100, current_price: 550,
    });
    const shortCall = pos({
      asset_type: 'derivative', option_type: 'call', quantity: -1,
      underlying: 'ADBE', description: 'ADBE CALL 600 DEC25',
      strike_price: 600, expiry_date: '2025-12-19',
    });
    const longLeap = pos({
      asset_type: 'derivative', option_type: 'call', quantity: 1,
      underlying: 'ADBE', description: 'ADBE CALL 400 JAN27',
      strike_price: 400, expiry_date: '2027-01-15',
    });
    const strategies = autoClassify([shortCall, longLeap], [stock, shortCall, longLeap]);
    const configs = buildConfigsFromStrategies(strategies);
    // Tutte le config puntano ad ADBE (nessun sottostante duplicato)
    for (const c of configs) expect(c.underlying).toBe('ADBE');
    // LEAP Call e Covered Call presenti
    const types = new Set(strategies.map(s => s.strategyType));
    expect(types.has('leap_call')).toBe(true);
    expect(types.has('covered_call')).toBe(true);
  });

  it('CRDO: CREDO TECHNOLOGY GRP + 100 azioni + short call + long put = DRCC', () => {
    const stock = pos({
      asset_type: 'stock', ticker: 'CRDO', isin: 'KYG254571055',
      description: 'CREDO TECHNOLOGY GRP', quantity: 100, current_price: 50,
    });
    const shortCall = pos({
      asset_type: 'derivative', option_type: 'call', quantity: -1,
      underlying: 'CRDO', description: 'CRDO CALL 60 DEC25',
      strike_price: 60, expiry_date: '2025-12-19',
    });
    const longPut = pos({
      asset_type: 'derivative', option_type: 'put', quantity: 1,
      underlying: 'CRDO', description: 'CRDO PUT 40 DEC25',
      strike_price: 40, expiry_date: '2025-12-19',
    });
    const strategies = autoClassify([shortCall, longPut], [stock, shortCall, longPut]);
    const drcc = strategies.find(s => s.strategyType === 'derisking_covered_call');
    expect(drcc, 'DRCC atteso').toBeTruthy();
    const configs = buildConfigsFromStrategies(strategies);
    for (const c of configs) expect(c.underlying).toBe('CRDO');
  });

  it('MBG: MERCEDES-BENZ GROUP (nessun ticker) + short call underlying=DAI = Covered Call unificata su MBG', () => {
    const stock = pos({
      asset_type: 'stock', ticker: null, isin: 'DE0007100000',
      description: 'MERCEDES-BENZ GROUP', quantity: 100, current_price: 60,
    });
    const shortCall = pos({
      asset_type: 'derivative', option_type: 'call', quantity: -1,
      underlying: 'DAI', description: 'DAI CALL 70 DEC25',
      strike_price: 70, expiry_date: '2025-12-19',
    });
    const strategies = autoClassify([shortCall], [stock, shortCall]);
    const cc = strategies.find(s => s.strategyType === 'covered_call');
    expect(cc, 'Covered Call attesa').toBeTruthy();
    const configs = buildConfigsFromStrategies(strategies);
    for (const c of configs) expect(c.underlying).toBe('MBG');
  });

  it('Dedup logico: config legacy "Adobe Inc" e config canonica "ADBE" producono lo stesso underlying al salvataggio', () => {
    // Simula riclassificazione: due naked put su Adobe classificate ora sotto un unico ticker canonico.
    const p1 = pos({
      asset_type: 'derivative', option_type: 'put', quantity: -1,
      underlying: 'ADBE', description: 'ADBE PUT 500 DEC25',
      strike_price: 500, expiry_date: '2025-12-19',
    });
    const p2 = pos({
      asset_type: 'derivative', option_type: 'put', quantity: -1,
      underlying: 'ADOBE INC', description: 'ADBE PUT 480 DEC25',
      strike_price: 480, expiry_date: '2025-12-19',
    });
    const strategies = autoClassify([p1, p2], [p1, p2]);
    const configs = buildConfigsFromStrategies(strategies);
    // Entrambe le NP finiscono sotto lo stesso underlying canonico
    const underlyings = new Set(configs.filter(c => c.strategy_type === 'naked_put').map(c => c.underlying));
    expect(underlyings.size).toBe(1);
    expect([...underlyings][0]).toBe('ADBE');
  });
});
