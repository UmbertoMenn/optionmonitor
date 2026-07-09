import { describe, it, expect } from 'vitest';
import { extractCallBuybacks } from '@/lib/callBuybacks';
import { FlussiTitoliOptionTrade } from '@/lib/flussiCsvParser';
import { StrategyConfiguration } from '@/hooks/useStrategyConfigurations';
import { Position } from '@/types/portfolio';

function trade(partial: Partial<FlussiTitoliOptionTrade> & { descriptor: string; underlyingTicker: string; optionType: 'call' | 'put'; strike: number; expiryDate: string; side: 'ACQ' | 'VEN'; contracts: number; pricePerShare: number }): FlussiTitoliOptionTrade {
  return {
    accountId: '02278918441',
    currency: 'USD',
    exchangeRate: 1.14,
    grossEUR: 0,
    commission: 8.74,
    tradeDate: '2026-07-02',
    ...partial,
  };
}

function soldCallPosition(underlying: string, strike: number, expiry: string, qty = -1): Position {
  return {
    id: `pos_${underlying}_${strike}`,
    portfolio_id: 'pf1',
    description: `${underlying} call ${strike}`,
    underlying,
    asset_type: 'derivative',
    option_type: 'call',
    strike_price: strike,
    expiry_date: expiry,
    quantity: qty,
    currency: 'USD',
    current_price: 1,
    market_value: 100,
    created_at: '',
    updated_at: '',
  } as unknown as Position;
}

function ccConfig(underlying: string, strike: number, expiry: string): StrategyConfiguration {
  return {
    id: `cfg_${underlying}`,
    portfolio_id: 'pf1',
    underlying,
    strategy_type: 'covered_call',
    position_signatures: [{ option_type: 'call', strike, expiry, quantity_sign: -1, quantity_abs: 1 }],
    is_synthetic: false,
    linked_stock_id: 'stock1',
    linked_stock_slot_ids: [],
    sort_order: 0,
    created_at: '',
    updated_at: '',
  } as unknown as StrategyConfiguration;
}

describe('extractCallBuybacks', () => {
  it('ACQ di una call venduta in posizione → riacquisto tracciato con prezzo', () => {
    const trades = [
      trade({ descriptor: 'MUQ6C1100', underlyingTicker: 'MU', optionType: 'call', strike: 1100, expiryDate: '2026-08-21', side: 'ACQ', contracts: 2, pricePerShare: 45.5 }),
    ];
    const positions = [soldCallPosition('MU', 1100, '2026-08-21', -2)];

    const { buybacks, resells } = extractCallBuybacks(trades, positions, []);
    expect(buybacks).toHaveLength(1);
    expect(buybacks[0].buyback_price).toBe(45.5);
    expect(buybacks[0].quantity).toBe(2);
    expect(buybacks[0].expiry_date).toBe('2026-08-21');
    expect(resells).toHaveLength(0);
  });

  it('ACQ che combacia solo con la firma di una config CC (posizione già sparita) → tracciato', () => {
    const trades = [
      trade({ descriptor: 'CEGU6C320', underlyingTicker: 'CEG', optionType: 'call', strike: 320, expiryDate: '2026-09-18', side: 'ACQ', contracts: 1, pricePerShare: 12.3 }),
    ];
    const configs = [ccConfig('CEG', 320, '2026-09-18')];

    const { buybacks } = extractCallBuybacks(trades, [], configs);
    expect(buybacks).toHaveLength(1);
    expect(buybacks[0].underlying).toBe('CEG');
  });

  it('ACQ di call MAI venduta (apertura LEAP, es. IREN del file reale) → NON è un riacquisto', () => {
    const trades = [
      trade({ descriptor: 'IRENF8C80', underlyingTicker: 'IREN', optionType: 'call', strike: 80, expiryDate: '2028-01-21', side: 'ACQ', contracts: 2, pricePerShare: 13.15 }),
    ];

    const { buybacks } = extractCallBuybacks(trades, [], []);
    expect(buybacks).toHaveLength(0);
  });

  it('le put sono ignorate (solo call da rivendere)', () => {
    const trades = [
      trade({ descriptor: 'MUQ6P900', underlyingTicker: 'MU', optionType: 'put', strike: 900, expiryDate: '2026-08-21', side: 'ACQ', contracts: 1, pricePerShare: 94 }),
    ];
    const { buybacks, resells } = extractCallBuybacks(trades, [soldCallPosition('MU', 1100, '2026-08-21')], []);
    expect(buybacks).toHaveLength(0);
    expect(resells).toHaveLength(0);
  });

  it('VEN dello stesso descrittore nello stesso file compensa il riacquisto (netting intra-file)', () => {
    const trades = [
      trade({ descriptor: 'MUQ6C1100', underlyingTicker: 'MU', optionType: 'call', strike: 1100, expiryDate: '2026-08-21', side: 'ACQ', contracts: 2, pricePerShare: 45.5, tradeDate: '2026-07-01' }),
      trade({ descriptor: 'MUQ6C1100', underlyingTicker: 'MU', optionType: 'call', strike: 1100, expiryDate: '2026-08-21', side: 'VEN', contracts: 1, pricePerShare: 50.0, tradeDate: '2026-07-02' }),
    ];
    const positions = [soldCallPosition('MU', 1100, '2026-08-21', -2)];

    const { buybacks, resells } = extractCallBuybacks(trades, positions, []);
    expect(buybacks).toHaveLength(1);
    expect(buybacks[0].quantity).toBe(1); // 2 riacquistate − 1 rivenduta
    expect(resells).toHaveLength(0); // interamente compensata intra-file
  });

  it('VEN senza riacquisto intra-file → rivendita da applicare ai buyback aperti nel DB', () => {
    const trades = [
      trade({ descriptor: 'MUQ6C1100', underlyingTicker: 'MU', optionType: 'call', strike: 1100, expiryDate: '2026-08-21', side: 'VEN', contracts: 1, pricePerShare: 52.0 }),
    ];
    const { buybacks, resells } = extractCallBuybacks(trades, [], []);
    expect(buybacks).toHaveLength(0);
    expect(resells).toHaveLength(1);
    expect(resells[0].descriptor).toBe('MUQ6C1100');
    expect(resells[0].resell_price).toBe(52);
  });
});
