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
export function useCallBuybacks(portfolioId: string | null | undefined) {
  const { data: buybacks = [], isLoading } = useQuery({
    queryKey: ['call-buybacks', portfolioId],
    queryFn: async (): Promise<CallBuybackRow[]> => {
      if (!portfolioId) return [];
      const { data, error } = await supabase
        .from('call_buybacks' as never)
        .select('*')
        .eq('portfolio_id', portfolioId)
        .gt('quantity', 0)
        .order('buyback_date', { ascending: false });
      if (error) {
        console.error('[useCallBuybacks] fetch error:', error.message);
        return [];
      }
      return (data || []) as unknown as CallBuybackRow[];
    },
    enabled: !!portfolioId,
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
