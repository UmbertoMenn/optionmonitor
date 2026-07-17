import { describe, it, expect } from 'vitest';
import { filterArchivedDerivatives } from '@/lib/refreshStrategyCache';
import { buildDynamicAliasMap, canonicalKeyForPosition, canonicalKeyForText } from '@/lib/tickerIdentity';
import { Position } from '@/types/portfolio';

function deriv(p: Partial<Position>): Position {
  return {
    id: Math.random().toString(36).slice(2),
    portfolio_id: 'pf1',
    isin: null, ticker: null, description: '', asset_type: 'derivative',
    currency: 'USD', exchange_rate: 1, quantity: -1,
    current_price: null, avg_cost: null, market_value: null,
    profit_loss: null, profit_loss_pct: null, weight_pct: null,
    option_type: 'call', strike_price: 100, expiry_date: '2026-12-18', underlying: null,
    snapshot_price: null, snapshot_market_value: null,
    created_at: '', updated_at: '',
    ...p,
  };
}

describe('filterArchivedDerivatives — cache cron: esclusione archiviati con identità canonica', () => {
  it('chiave archiviata canonica + derivato risolvibile solo via alias dinamico → escluso', () => {
    const dynamicAliases = buildDynamicAliasMap([
      { underlying: 'GENERIC SMALLCAP SPA', ticker: 'GSC' },
    ]);
    const d = deriv({ underlying: 'GENERIC SMALLCAP SPA', description: 'GENERIC SMALLCAP SPA CALL 100 DIC26' });
    // Il wizard salva la chiave canonica
    const archivedKey = canonicalKeyForPosition(d, dynamicAliases);
    expect(archivedKey).toBe('GSC');

    const out = filterArchivedDerivatives([d], [archivedKey], dynamicAliases);
    expect(out).toHaveLength(0);
  });

  it('stesso caso SENZA alias dinamici (comportamento raw legacy) → NON escluso: prova il bug', () => {
    const dynamicAliases = buildDynamicAliasMap([
      { underlying: 'GENERIC SMALLCAP SPA', ticker: 'GSC' },
    ]);
    const d = deriv({ underlying: 'GENERIC SMALLCAP SPA' });
    const archivedKey = canonicalKeyForPosition(d, dynamicAliases); // 'GSC'

    // Senza aliases: canonicalKeyForPosition(d) → NAME:GENERIC SMALLCAP ≠ 'GSC',
    // e il raw fallback 'GSC' ≠ 'GENERIC SMALLCAP SPA'.
    const out = filterArchivedDerivatives([d], [archivedKey], undefined);
    expect(out).toHaveLength(1);
  });

  it('chiave archiviata NAME: (fallback deterministico, es. BIO ON) → derivato con stesso testo escluso', () => {
    const d = deriv({ underlying: 'BIO ON', description: 'BIO ON CALL 1 DIC26' });
    const archivedKey = canonicalKeyForPosition(d, undefined);
    expect(archivedKey.startsWith('NAME:')).toBe(true);

    const out = filterArchivedDerivatives([d], [archivedKey], undefined);
    expect(out).toHaveLength(0);
  });

  it('chiave legacy in formato testuale grezzo (pre-canonicalizzazione) → esclusa via fallback raw', () => {
    const d = deriv({ underlying: 'ETN WT BITCOIN BTCW SW' });
    // Chiave storica salvata com\'era: testo normalizzato, non canonico
    const out = filterArchivedDerivatives([d], ['ETN WT BITCOIN BTCW SW'], undefined);
    expect(out).toHaveLength(0);
  });

  it('derivato NON archiviato resta intatto; ticker canonico da mappa statica escluso correttamente', () => {
    const archived = deriv({ underlying: 'AAPL', description: 'APPLE CALL 200 DIC26' });
    const kept = deriv({ underlying: 'MSFT', description: 'MICROSOFT CALL 500 DIC26' });
    // Il wizard archivierebbe 'AAPL' (canonico via mappa statica anche da 'APPLE INC')
    expect(canonicalKeyForText('APPLE INC', undefined)).toBe('AAPL');

    const out = filterArchivedDerivatives([archived, kept], ['AAPL'], undefined);
    expect(out).toHaveLength(1);
    expect(out[0].underlying).toBe('MSFT');
  });

  it('nessuna chiave archiviata → lista invariata (stesso riferimento)', () => {
    const d = deriv({ underlying: 'AAPL' });
    const input = [d];
    expect(filterArchivedDerivatives(input, [], undefined)).toBe(input);
    expect(filterArchivedDerivatives(input, ['  ', ''], undefined)).toBe(input);
  });

  it('canonicalKeyForText è idempotente sulle chiavi NAME: (round-trip con canonicalKeyForPosition)', () => {
    // Formato reale presente in archived_underlyings (es. NAME:BANCA SELLA CAT S)
    expect(canonicalKeyForText('NAME:BANCA SELLA CAT S', undefined)).toBe('NAME:BANCA SELLA CAT S');
    // Round-trip completo posizione → chiave → chiave
    const d = deriv({ underlying: 'BIO ON', description: 'BIO ON CALL 1 DIC26' });
    const key = canonicalKeyForPosition(d, undefined);
    expect(canonicalKeyForText(key, undefined)).toBe(key);
    // Doppia applicazione stabile
    expect(canonicalKeyForText(canonicalKeyForText(key, undefined), undefined)).toBe(key);
  });
});
