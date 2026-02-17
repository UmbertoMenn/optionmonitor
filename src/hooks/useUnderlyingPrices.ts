import { useCallback, useMemo, useState } from 'react';
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
  missingCount: number;
  isFetchingMissing: boolean;
}

const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

interface LocalFetchResult {
  prices: Record<string, UnderlyingPrice>;
  missingUnderlyings: string[];
}

async function fetchLocalPrices(uniqueUnderlyings: string[]): Promise<LocalFetchResult> {
  if (uniqueUnderlyings.length === 0) return { prices: {}, missingUnderlyings: [] };

  const [mappingsRes, pricesRes] = await Promise.all([
    supabase.from('underlying_mappings').select('underlying, ticker'),
    supabase.from('underlying_prices').select('ticker, price, currency, updated_at'),
  ]);

  const underlyingToTicker: Record<string, string> = {};
  if (mappingsRes.data) {
    const directMap = new Map(mappingsRes.data.map(m => [m.underlying, m.ticker]));
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

  const tickerPrices: Record<string, { price: number; currency: string; updated_at: string }> = {};
  if (pricesRes.data) {
    for (const p of pricesRes.data) {
      tickerPrices[p.ticker] = { price: Number(p.price), currency: p.currency, updated_at: p.updated_at };
    }
  }

  const prices: Record<string, UnderlyingPrice> = {};
  const missingUnderlyings: string[] = [];

  for (const underlying of uniqueUnderlyings) {
    const ticker = underlyingToTicker[underlying];
    if (ticker && tickerPrices[ticker]) {
      const { price, currency, updated_at } = tickerPrices[ticker];
      const isStale = Date.now() - new Date(updated_at).getTime() > STALE_THRESHOLD_MS;
      prices[underlying] = { price, currency, ticker, isStale, updatedAt: updated_at };
    } else {
      missingUnderlyings.push(underlying);
    }
  }

  return { prices, missingUnderlyings };
}

async function fetchMissingPrices(missingUnderlyings: string[]): Promise<Record<string, UnderlyingPrice>> {
  if (missingUnderlyings.length === 0) return {};

  console.log(`Fetching ${missingUnderlyings.length} missing prices from edge function`);
  const { data, error } = await supabase.functions.invoke('fetch-underlying-prices', {
    body: { underlyings: missingUnderlyings },
  });

  const results: Record<string, UnderlyingPrice> = {};
  if (!error && data?.prices) {
    for (const [underlying, priceData] of Object.entries(data.prices)) {
      results[underlying] = priceData as UnderlyingPrice;
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

  // Phase 1: Local DB fetch (fast, <300ms)
  const { data: localData, isLoading: isLoadingLocal, error: localError } = useQuery({
    queryKey: ['underlying-prices-local', underlyingsKey],
    queryFn: () => fetchLocalPrices(uniqueUnderlyings),
    enabled: uniqueUnderlyings.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const missingUnderlyings = localData?.missingUnderlyings ?? [];
  const missingKey = missingUnderlyings.join('|');

  // Phase 2: Edge function for missing (slow, background)
  const { data: missingData, isFetching: isFetchingMissing } = useQuery({
    queryKey: ['underlying-prices-missing', missingKey],
    queryFn: () => fetchMissingPrices(missingUnderlyings),
    enabled: missingUnderlyings.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Merge local + missing
  const mergedPrices = useMemo(() => {
    const local = localData?.prices ?? {};
    const missing = missingData ?? {};
    return { ...local, ...missing };
  }, [localData?.prices, missingData]);

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['underlying-prices-local'] });
    queryClient.invalidateQueries({ queryKey: ['underlying-prices-missing'] });
  }, [queryClient]);

  return {
    prices: mergedPrices,
    isLoading: isLoadingLocal,
    error: localError ? (localError instanceof Error ? localError.message : 'Unknown error') : null,
    refetch,
    missingCount: missingUnderlyings.length,
    isFetchingMissing,
  };
}
