import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CallBuybackRow {
  id: string;
  portfolio_id: string;
  underlying: string;
  descriptor: string;
  strike: number;
  expiry_date: string;
  quantity: number;
  buyback_price: number;
  currency: string;
  exchange_rate: number;
  buyback_date: string;
  market_price: number | null;
  market_price_updated_at: string | null;
  resold_quantity: number;
  resell_price: number | null;
  resell_date: string | null;
}

/**
 * Riacquisti di call CC/DR-CC ancora aperti (quantità > 0).
 * Il valore di mercato mostrato a video è 0 per le call scadute.
 */
export function useCallBuybacks(portfolioIds: Array<string | null | undefined>) {
  const validPortfolioIds = portfolioIds.filter((id): id is string => !!id);
  const { data: buybacks = [], isLoading } = useQuery({
    queryKey: ['call-buybacks', validPortfolioIds],
    queryFn: async (): Promise<CallBuybackRow[]> => {
      if (validPortfolioIds.length === 0) return [];
      const { data, error } = await supabase
        .from('call_buybacks' as never)
        .select('*')
        .in('portfolio_id', validPortfolioIds)
        .gt('quantity', 0)
        .order('buyback_date', { ascending: false });
      if (error) {
        console.error('[useCallBuybacks] fetch error:', error.message);
        return [];
      }
      return (data || []) as unknown as CallBuybackRow[];
    },
    enabled: validPortfolioIds.length > 0,
    staleTime: 60_000,
  });

  return { buybacks, isLoading };
}

/** Valore di mercato effettivo: 0 se la call è scaduta. */
export function effectiveMarketPrice(row: CallBuybackRow, todayISO?: string): number {
  const today = todayISO || new Date().toISOString().split('T')[0];
  if (row.expiry_date < today) return 0;
  return row.market_price ?? 0;
}

/** Valore di mercato complessivo dei riacquisti aperti, convertito in EUR. */
export function openCallBuybacksValueEUR(rows: CallBuybackRow[], todayISO?: string): number {
  return rows.reduce((total, row) => {
    const exchangeRate = row.exchange_rate > 0 ? row.exchange_rate : 1;
    return total + (effectiveMarketPrice(row, todayISO) * 100 * row.quantity) / exchangeRate;
  }, 0);
}

/** G/P potenziale complessivo (mercato − riacquisto) dei riacquisti aperti, convertito in EUR. */
export function openCallBuybacksGainLossEUR(rows: CallBuybackRow[], todayISO?: string): number {
  return rows.reduce((total, row) => {
    const exchangeRate = row.exchange_rate > 0 ? row.exchange_rate : 1;
    const gainLossPerShare = effectiveMarketPrice(row, todayISO) - row.buyback_price;
    return total + (gainLossPerShare * 100 * row.quantity) / exchangeRate;
  }, 0);
}
