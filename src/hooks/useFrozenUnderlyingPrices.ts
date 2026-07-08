import { useMemo } from 'react';
import { useHistoricalData } from '@/hooks/useHistoricalData';
import { UnderlyingPrice } from '@/hooks/useUnderlyingPrices';
import { Portfolio } from '@/types/portfolio';

/**
 * Prezzi CONGELATI dello snapshot corrente del portafoglio, con fallback ai prezzi live
 * per i sottostanti non ancora congelati (es. snapshot non ancora ricalcolato).
 *
 * È la stessa logica usata da Dashboard e Stress Lab: i valori di netting NON devono
 * muoversi coi prezzi live, ma restare ancorati a historical_data.snapshot_underlying_prices
 * della data di snapshot corrente. Estratta in hook per garantire che Dashboard,
 * Risk Analyzer e proiezioni usino ESATTAMENTE la stessa fonte prezzi.
 */
export function useFrozenUnderlyingPrices(
  portfolio: Portfolio | null | undefined,
  livePrices: Record<string, UnderlyingPrice>,
): Record<string, UnderlyingPrice> {
  const { historicalData } = useHistoricalData(portfolio?.id);

  return useMemo(() => {
    const currentDate = portfolio?.snapshot_date;
    const currentEntry = currentDate
      ? historicalData.find(h => h.snapshot_date === currentDate)
      : null;
    const frozenRaw = (currentEntry?.snapshot_underlying_prices ?? {}) as Record<string, number>;
    const merged: Record<string, UnderlyingPrice> = {};
    for (const [k, v] of Object.entries(livePrices)) merged[k] = v;
    for (const [k, px] of Object.entries(frozenRaw)) {
      if (typeof px === 'number' && px > 0) merged[k] = { price: px, currency: 'USD' };
    }
    return merged;
  }, [portfolio?.snapshot_date, historicalData, livePrices]);
}
