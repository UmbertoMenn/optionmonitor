/**
 * Tracciamento dei riacquisti di call appartenenti a Covered Call /
 * De-Risking Covered Call ("call da rivendere").
 *
 * Dal file Movimenti Titoli:
 *  - un ACQ di una call che risulta VENDUTA nelle posizioni correnti o
 *    nelle firme delle config covered_call / derisking_covered_call è un
 *    RIACQUISTO → va tracciato con il prezzo di riacquisto (serve per il
 *    gain alla rivendita) e successivamente con il prezzo di mercato
 *    corrente (serve per il patrimonio netting intrinseco mancante).
 *  - un VEN di una call con stesso descrittore di un riacquisto aperto è
 *    la RIVENDITA → chiude il riacquisto (quantità per quantità).
 *
 * Le call mai vendute e quelle scadute senza rivendita hanno valore di
 * mercato zero; la discriminazione a video è la presenza del ticker nella
 * card "Call da rivendere" (che già esclude gli archiviati).
 */
import { Position } from '@/types/portfolio';
import { StrategyConfiguration, PositionSignature } from '@/hooks/useStrategyConfigurations';
import { FlussiTitoliOptionTrade } from '@/lib/flussiCsvParser';
import { normalizeForMatching, getCanonicalKey } from '@/lib/derivativeStrategies';

export interface CallBuybackInsert {
  underlying: string; // ticker del sottostante (dal descrittore)
  descriptor: string;
  strike: number;
  expiry_date: string;
  quantity: number;
  buyback_price: number; // per azione, divisa del titolo
  currency: string;
  exchange_rate: number;
  buyback_date: string;
}

export interface CallResell {
  descriptor: string;
  strike: number;
  expiry_date: string;
  quantity: number;
  resell_price: number; // per azione
  resell_date: string;
}

export interface CallBuybackExtraction {
  buybacks: CallBuybackInsert[];
  resells: CallResell[];
}

function norm(text: string): string {
  return getCanonicalKey(text) || normalizeForMatching(text);
}

/** True se il trade combacia (sottostante, strike, scadenza) con una call VENDUTA. */
function matchesSoldCall(
  trade: FlussiTitoliOptionTrade,
  positions: Position[],
  configs: StrategyConfiguration[],
): boolean {
  const tKey = norm(trade.underlyingTicker);

  // 1) Posizioni correnti: call vendute
  const inPositions = positions.some(p => {
    if (p.asset_type !== 'derivative') return false;
    if ((p.option_type || '').toLowerCase() !== 'call') return false;
    if (p.quantity >= 0) return false;
    if (Math.abs((p.strike_price || 0) - trade.strike) > 0.01) return false;
    if ((p.expiry_date || '') !== trade.expiryDate) return false;
    const pKey = norm(p.underlying || p.description || '');
    return pKey === tKey || pKey.includes(tKey) || tKey.includes(pKey);
  });
  if (inPositions) return true;

  // 2) Firme delle config CC / de-risking (copre il caso in cui la posizione
  //    è già stata rimossa dal nuovo snapshot saldi)
  return configs.some(c => {
    if (c.strategy_type !== 'covered_call' && c.strategy_type !== 'derisking_covered_call') return false;
    const cKey = norm(c.underlying);
    if (!(cKey === tKey || cKey.includes(tKey) || tKey.includes(cKey))) return false;
    const sigs = (c.position_signatures as unknown as PositionSignature[]) || [];
    return sigs.some(s =>
      (s.option_type || '').toLowerCase() === 'call' &&
      s.quantity_sign === -1 &&
      Math.abs(s.strike - trade.strike) < 0.01 &&
      s.expiry === trade.expiryDate,
    );
  });
}

/**
 * Estrae dai movimenti titoli i riacquisti di call CC/DR-CC e le rivendite
 * che chiudono riacquisti precedenti (incluse quelle intra-file: un ACQ e
 * un VEN dello stesso descrittore nello stesso file si compensano).
 */
export function extractCallBuybacks(
  trades: FlussiTitoliOptionTrade[],
  positions: Position[],
  configs: StrategyConfiguration[],
): CallBuybackExtraction {
  const buybacks: CallBuybackInsert[] = [];
  const resells: CallResell[] = [];

  const callTrades = trades
    .filter(t => t.optionType === 'call')
    .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));

  for (const t of callTrades) {
    if (t.side === 'ACQ') {
      if (!matchesSoldCall(t, positions, configs)) continue; // apertura long (LEAP), non un riacquisto
      buybacks.push({
        underlying: t.underlyingTicker,
        descriptor: t.descriptor,
        strike: t.strike,
        expiry_date: t.expiryDate,
        quantity: t.contracts,
        buyback_price: t.pricePerShare,
        currency: t.currency,
        exchange_rate: t.exchangeRate,
        buyback_date: t.tradeDate,
      });
    } else {
      // VEN: chiude riacquisti aperti con lo stesso descrittore (prima intra-file)
      let remaining = t.contracts;
      for (const b of buybacks) {
        if (remaining <= 0) break;
        if (b.descriptor !== t.descriptor) continue;
        const take = Math.min(b.quantity, remaining);
        b.quantity -= take;
        remaining -= take;
      }
      if (remaining > 0) {
        resells.push({
          descriptor: t.descriptor,
          strike: t.strike,
          expiry_date: t.expiryDate,
          quantity: remaining,
          resell_price: t.pricePerShare,
          resell_date: t.tradeDate,
        });
      }
    }
  }

  return {
    buybacks: buybacks.filter(b => b.quantity > 0),
    resells,
  };
}
