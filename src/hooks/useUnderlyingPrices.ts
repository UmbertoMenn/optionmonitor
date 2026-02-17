import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Normalize name for matching (same logic as edge function)
function normalizeName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[.,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\bINC\b/g, '')
    .replace(/\bCORP\b/g, '')
    .replace(/\bLTD\b/g, '')
    .replace(/\bLLC\b/g, '')
    .replace(/\bPLC\b/g, '')
    .replace(/\bCO\b/g, '')
    .replace(/\bTHE\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface UnderlyingPrice {
  price: number;
  currency: string;
  ticker?: string;
  isStale?: boolean;
  updatedAt?: string;
}

export interface UseUnderlyingPricesResult {
  prices: Record<string, UnderlyingPrice>;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

async function fetchUnderlyingPrices(uniqueUnderlyings: string[]): Promise<Record<string, UnderlyingPrice>> {
  if (uniqueUnderlyings.length === 0) return {};

  // Step 1: Parallel fetch of ALL mappings + ALL prices (both tables are small)
  const [mappingsRes, pricesRes] = await Promise.all([
    supabase.from('underlying_mappings').select('underlying, ticker'),
    supabase.from('underlying_prices').select('ticker, price, currency, updated_at'),
  ]);

  // Build normalized mapping lookup
  const underlyingToTicker: Record<string, string> = {};
  if (mappingsRes.data) {
    // Direct match first
    const directMap = new Map(mappingsRes.data.map(m => [m.underlying, m.ticker]));
    // Normalized lookup
    const normalizedMap = new Map<string, string>();
    for (const m of mappingsRes.data) {
      const norm = normalizeName(m.underlying);
      if (!normalizedMap.has(norm)) normalizedMap.set(norm, m.ticker);
    }

    for (const u of uniqueUnderlyings) {
      const direct = directMap.get(u);
      if (direct) {
        underlyingToTicker[u] = direct;
      } else {
        const fallback = normalizedMap.get(normalizeName(u));
        if (fallback) underlyingToTicker[u] = fallback;
      }
    }
  }

  // Build ticker -> price lookup
  const tickerPrices: Record<string, { price: number; currency: string; updated_at: string }> = {};
  if (pricesRes.data) {
    for (const p of pricesRes.data) {
      tickerPrices[p.ticker] = { price: Number(p.price), currency: p.currency, updated_at: p.updated_at };
    }
  }

  // Step 2: Local matching (instant)
  const results: Record<string, UnderlyingPrice> = {};
  for (const underlying of uniqueUnderlyings) {
    const ticker = underlyingToTicker[underlying];
    if (ticker && tickerPrices[ticker]) {
      const { price, currency, updated_at } = tickerPrices[ticker];
      const isStale = Date.now() - new Date(updated_at).getTime() > STALE_THRESHOLD_MS;
      results[underlying] = { price, currency, ticker, isStale, updatedAt: updated_at };
    }
  }

  // Step 3: Edge function only for missing underlyings
  const missingUnderlyings = uniqueUnderlyings.filter(u => !results[u]);
  if (missingUnderlyings.length > 0) {
    console.log(`Fetching ${missingUnderlyings.length} missing prices from edge function`);
    const { data, error } = await supabase.functions.invoke('fetch-underlying-prices', {
      body: { underlyings: missingUnderlyings },
    });
    if (!error && data?.prices) {
      for (const [underlying, priceData] of Object.entries(data.prices)) {
        results[underlying] = priceData as UnderlyingPrice;
      }
    }
  }

  return results;
}

export function useUnderlyingPrices(underlyings: string[]): UseUnderlyingPricesResult {
  const queryClient = useQueryClient();

  const uniqueUnderlyings = useMemo(
    () => [...new Set(underlyings.filter(u => u && typeof u === 'string'))].sort(),
    [underlyings],
  );

  const underlyingsKey = useMemo(() => uniqueUnderlyings.join('|'), [uniqueUnderlyings]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['underlying-prices', underlyingsKey],
    queryFn: () => fetchUnderlyingPrices(uniqueUnderlyings),
    enabled: uniqueUnderlyings.length > 0,
    staleTime: 5 * 60 * 1000, // 5 min, aligned with cron
  });

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['underlying-prices'] });
  }, [queryClient]);

  return {
    prices: data ?? {},
    isLoading,
    error: error ? (error instanceof Error ? error.message : 'Unknown error') : null,
    refetch,
  };
}
