import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Position } from '@/types/portfolio';
import { toast } from 'sonner';

export interface LivePriceData {
  symbol: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
  bid: number | null;
  ask: number | null;
  volume: number | null;
  lastUpdated: string;
  source: 'tradier' | 'yahoo' | 'error';
  error?: string;
}

interface OptionRequest {
  underlying: string;
  expiry: string;
  optionType: 'call' | 'put';
  strike: number;
  originalId: string;
}

interface FetchResult {
  stocks: Record<string, LivePriceData>;
  options: Record<string, LivePriceData>;
  fetchedAt: string;
}

interface UseLivePricesOptions {
  intervalMs?: number;
  enabled?: boolean;
}

export function useLivePrices(
  positions: Position[],
  options: UseLivePricesOptions = {}
) {
  const { intervalMs = 300000, enabled = true } = options; // Default 5 minutes
  
  const [stockPrices, setStockPrices] = useState<Record<string, LivePriceData>>({});
  const [optionPrices, setOptionPrices] = useState<Record<string, LivePriceData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const fetchPrices = useCallback(async () => {
    if (positions.length === 0) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Separate stocks/ETFs from derivatives
      const stockPositions = positions.filter(
        p => p.asset_type === 'stock' || p.asset_type === 'etf'
      );
      const derivativePositions = positions.filter(
        p => p.asset_type === 'derivative' && 
             p.underlying && 
             p.expiry_date && 
             p.option_type && 
             p.strike_price
      );
      
      // Extract unique tickers for stocks/ETFs
      const tickers = [...new Set(
        stockPositions
          .map(p => p.ticker)
          .filter((t): t is string => !!t)
      )];
      
      // Build option requests
      const optionRequests: OptionRequest[] = derivativePositions.map(p => ({
        underlying: p.underlying!,
        expiry: p.expiry_date!,
        optionType: p.option_type as 'call' | 'put',
        strike: p.strike_price!,
        originalId: p.id,
      }));
      
      console.log(`Fetching live prices: ${tickers.length} stocks, ${optionRequests.length} options`);
      
      const { data, error: fnError } = await supabase.functions.invoke<FetchResult>(
        'fetch-market-prices',
        {
          body: {
            tickers,
            options: optionRequests,
          },
        }
      );
      
      if (fnError) {
        throw new Error(fnError.message);
      }
      
      if (data) {
        setStockPrices(data.stocks || {});
        setOptionPrices(data.options || {});
        setLastFetched(new Date(data.fetchedAt));
        
        // Count successful fetches
        const stockCount = Object.values(data.stocks || {}).filter(s => s.source !== 'error').length;
        const optionCount = Object.values(data.options || {}).filter(o => o.source !== 'error').length;
        
        console.log(`Fetched ${stockCount}/${tickers.length} stocks, ${optionCount}/${optionRequests.length} options`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore nel recupero prezzi';
      setError(errorMessage);
      console.error('Error fetching live prices:', err);
    } finally {
      setIsLoading(false);
    }
  }, [positions]);
  
  // Manual refresh function
  const refresh = useCallback(() => {
    fetchPrices();
    toast.info('Aggiornamento prezzi in corso...');
  }, [fetchPrices]);
  
  // Initial fetch and interval setup
  useEffect(() => {
    if (!enabled || positions.length === 0) return;
    
    // Initial fetch
    fetchPrices();
    
    // Set up interval
    intervalRef.current = setInterval(fetchPrices, intervalMs);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, fetchPrices, intervalMs, positions.length]);
  
  // Get price for a specific position
  const getPriceForPosition = useCallback((position: Position): LivePriceData | null => {
    if (position.asset_type === 'derivative') {
      return optionPrices[position.id] || null;
    } else if (position.ticker) {
      return stockPrices[position.ticker] || null;
    }
    return null;
  }, [stockPrices, optionPrices]);
  
  return {
    stockPrices,
    optionPrices,
    isLoading,
    lastFetched,
    error,
    refresh,
    getPriceForPosition,
  };
}
