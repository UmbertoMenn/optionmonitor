import { describe, it, expect } from 'vitest';
import { extractCallBuybacks } from '@/lib/callBuybacks';
import { CallBuybackRow, openCallBuybacksValueEUR, openCallBuybacksGainLossEUR } from '@/hooks/useCallBuybacks';
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

  describe('openCallBuybacksValueEUR', () => {
    it('converte il valore di mercato delle call aperte in EUR', () => {
      const rows: CallBuybackRow[] = [{
        id: 'buyback-1',
        portfolio_id: 'pf1',
        underlying: 'MU',
        descriptor: 'MUQ6C1100',
        strike: 1100,
        expiry_date: '2026-08-21',
        quantity: 2,
        buyback_price: 45.5,
        currency: 'USD',
        exchange_rate: 1.25,
        buyback_date: '2026-07-02',
        market_price: 50,
        market_price_updated_at: null,
        resold_quantity: 0,
        resell_price: null,
        resell_date: null,
        included_in_netting: true,
        manually_edited: false,
      }];

      expect(openCallBuybacksValueEUR(rows, '2026-07-10')).toBe(8000);
    });

    it('esclude le call scadute', () => {
      const row = {
        id: 'buyback-1',
        portfolio_id: 'pf1',
        underlying: 'MU',
        descriptor: 'MUQ6C1100',
        strike: 1100,
        expiry_date: '2026-07-01',
        quantity: 1,
        buyback_price: 45.5,
        currency: 'USD',
        exchange_rate: 1,
        buyback_date: '2026-06-02',
        market_price: 50,
        market_price_updated_at: null,
        resold_quantity: 0,
        resell_price: null,
        resell_date: null,
        included_in_netting: true,
        manually_edited: false,
      } satisfies CallBuybackRow;

      expect(openCallBuybacksValueEUR([row], '2026-07-10')).toBe(0);
    });
  });

  describe('openCallBuybacksGainLossEUR', () => {
    it('converte il G/P potenziale (mercato - riacquisto) in EUR', () => {
      const rows: CallBuybackRow[] = [{
        id: 'buyback-1',
        portfolio_id: 'pf1',
        underlying: 'MU',
        descriptor: 'MUQ6C1100',
        strike: 1100,
        expiry_date: '2026-08-21',
        quantity: 2,
        buyback_price: 45.5,
        currency: 'USD',
        exchange_rate: 1.25,
        buyback_date: '2026-07-02',
        market_price: 50,
        market_price_updated_at: null,
        resold_quantity: 0,
        resell_price: null,
        resell_date: null,
        included_in_netting: true,
        manually_edited: false,
      }];

      // (50 - 45.5) * 100 * 2 / 1.25 = 720
      expect(openCallBuybacksGainLossEUR(rows, '2026-07-10')).toBeCloseTo(720);
    });

    it('somma correttamente più riacquisti in valute diverse (nessun mix senza conversione)', () => {
      const rows: CallBuybackRow[] = [
        {
          id: 'buyback-usd',
          portfolio_id: 'pf1',
          underlying: 'MU',
          descriptor: 'MUQ6C1100',
          strike: 1100,
          expiry_date: '2026-08-21',
          quantity: 1,
          buyback_price: 40,
          currency: 'USD',
          exchange_rate: 1.25,
          buyback_date: '2026-07-02',
          market_price: 50,
          market_price_updated_at: null,
          resold_quantity: 0,
          resell_price: null,
          resell_date: null,
          included_in_netting: true,
          manually_edited: false,
        },
        {
          id: 'buyback-eur',
          portfolio_id: 'pf1',
          underlying: 'SAP',
          descriptor: 'SAPQ6C200',
          strike: 200,
          expiry_date: '2026-08-21',
          quantity: 1,
          buyback_price: 10,
          currency: 'EUR',
          exchange_rate: 1,
          buyback_date: '2026-07-02',
          market_price: 15,
          market_price_updated_at: null,
          resold_quantity: 0,
          resell_price: null,
          resell_date: null,
          included_in_netting: true,
          manually_edited: false,
        },
      ];

      // USD: (50-40)*100*1/1.25 = 800; EUR: (15-10)*100*1/1 = 500 → 1300
      expect(openCallBuybacksGainLossEUR(rows, '2026-07-10')).toBeCloseTo(1300);
    });

    it('esclude le call scadute dal G/P (valore di mercato effettivo 0)', () => {
      const row = {
        id: 'buyback-1',
        portfolio_id: 'pf1',
        underlying: 'MU',
        descriptor: 'MUQ6C1100',
        strike: 1100,
        expiry_date: '2026-07-01',
        quantity: 1,
        buyback_price: 45.5,
        currency: 'USD',
        exchange_rate: 1,
        buyback_date: '2026-06-02',
        market_price: 50,
        market_price_updated_at: null,
        resold_quantity: 0,
        resell_price: null,
        resell_date: null,
        included_in_netting: true,
        manually_edited: false,
      } satisfies CallBuybackRow;

      // scaduta → mercato effettivo 0 → G/P = (0 - 45.5) * 100 * 1 = -4550
      expect(openCallBuybacksGainLossEUR([row], '2026-07-10')).toBeCloseTo(-4550);
    });
  });

  describe('included_in_netting: la deselezione esclude la riga dai totali', () => {
    const base = {
      id: 'b1',
      portfolio_id: 'pf1',
      underlying: 'MU',
      descriptor: 'MUQ6C1100',
      strike: 1100,
      expiry_date: '2026-08-21',
      quantity: 1,
      buyback_price: 40,
      currency: 'USD',
      exchange_rate: 1,
      buyback_date: '2026-07-02',
      market_price: 50,
      market_price_updated_at: null,
      resold_quantity: 0,
      resell_price: null,
      resell_date: null,
      manually_edited: false,
    };

    it('una riga esclusa non contribuisce né al premio né al G/P', () => {
      const included = { ...base, id: 'in', included_in_netting: true } satisfies CallBuybackRow;
      const excluded = { ...base, id: 'out', included_in_netting: false } satisfies CallBuybackRow;

      // Solo la riga inclusa conta: valore mercato 50*100*1/1 = 5000; G/P (50-40)*100 = 1000
      expect(openCallBuybacksValueEUR([included, excluded], '2026-07-10')).toBeCloseTo(5000);
      expect(openCallBuybacksGainLossEUR([included, excluded], '2026-07-10')).toBeCloseTo(1000);
    });

    it('tutte escluse → totali a zero', () => {
      const excluded = { ...base, included_in_netting: false } satisfies CallBuybackRow;
      expect(openCallBuybacksValueEUR([excluded], '2026-07-10')).toBe(0);
      expect(openCallBuybacksGainLossEUR([excluded], '2026-07-10')).toBe(0);
    });
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
