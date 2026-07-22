import { describe, it, expect } from 'vitest';
import { categorizeDerivatives } from '@/lib/derivativeStrategies';
import { computeMonitoring } from '@/lib/monitoringEngine';
import { buildDynamicAliasMap } from '@/lib/tickerIdentity';
import { Position } from '@/types/portfolio';

function pos(p: Partial<Position>): Position {
  return {
    id: Math.random().toString(36).slice(2),
    portfolio_id: 'pf1',
    isin: null, ticker: null, description: '', asset_type: 'derivative',
    currency: 'EUR', exchange_rate: 1, quantity: 0,
    current_price: null, avg_cost: null, market_value: null,
    profit_loss: null, profit_loss_pct: null, weight_pct: null,
    option_type: null, strike_price: null, expiry_date: null, underlying: null,
    snapshot_price: null, snapshot_market_value: null,
    created_at: '', updated_at: '',
    ...p,
  };
}

// andreaz: 100 azioni Ferrari (RACE.MI / ISIN NL0011585146) + 1 short call il cui
// codice di banca è "RAC". La call è coperta dalle 100 azioni, ma il conteggio
// "Call non coperte" mostrava "RACE: 1 NC" perché usava una risoluzione locale
// divergente (azione → RACE, call → RAC su chiavi diverse).
describe('computeMonitoring — call non coperte su titolo europeo (Ferrari)', () => {
  const ferrariStock = () => pos({
    asset_type: 'stock', ticker: 'RACE.MI', isin: 'NL0011585146',
    description: 'FERRARI NV', quantity: 100, current_price: 320,
  });
  const ferrariCall = () => pos({
    asset_type: 'derivative', option_type: 'call', quantity: -1,
    underlying: 'RAC', description: '[RAC][12/26][C][322]', strike_price: 322,
    expiry_date: '2026-12-18',
  });

  it('con RAC → RACE mappato, la call risulta COPERTA (nessuna NC)', () => {
    const dyn = buildDynamicAliasMap([{ underlying: 'RAC', ticker: 'RACE' }]);
    const stock = ferrariStock();
    const call = ferrariCall();
    const cats = categorizeDerivatives([call], [stock], [], [], { dynamicAliases: dyn });
    const monitoring = computeMonitoring(cats, [stock, call], [stock], {}, [], [], dyn);
    expect(monitoring.uncoveredCalls).toHaveLength(0);
  });

  it('PROVA DEL BUG: senza mappatura RAC→RACE azione e call divergono → 1 NC', () => {
    const stock = ferrariStock();
    const call = ferrariCall();
    const cats = categorizeDerivatives([call], [stock], [], []);
    const monitoring = computeMonitoring(cats, [stock, call], [stock], {}, [], []);
    // Azione → RACE (via ISIN/borsa), call → RAC (codice grezzo): chiavi diverse,
    // quindi le azioni non coprono la call e resta 1 contratto scoperto.
    expect(monitoring.uncoveredCalls).toHaveLength(1);
    expect(monitoring.uncoveredCalls[0].uncoveredContracts).toBe(1);
  });

  it('una short call SENZA azioni resta correttamente scoperta', () => {
    const dyn = buildDynamicAliasMap([{ underlying: 'RAC', ticker: 'RACE' }]);
    const call = ferrariCall();
    const cats = categorizeDerivatives([call], [], [], [], { dynamicAliases: dyn });
    const monitoring = computeMonitoring(cats, [call], [], {}, [], [], dyn);
    expect(monitoring.uncoveredCalls).toHaveLength(1);
    expect(monitoring.uncoveredCalls[0].ticker).toBe('RACE');
  });
});
