import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface ETFTopHolding {
  name: string;
  percentage: number;
  isin?: string;
}

export interface ETFAllocation {
  isin: string;
  name: string;
  countryAllocations: Record<string, number>;
  currencyAllocations: Record<string, number>;
  sectorAllocations: Record<string, number>;
  topHoldings: ETFTopHolding[];
  isHedged: boolean;
  cached?: boolean;
  fromDbFallback?: boolean;
}

export function useETFAllocations() {
  const [allocations, setAllocations] = useState<Record<string, ETFAllocation>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fallback: fetch from DB cache when edge function fails
  const fetchFromDbCache = useCallback(async (isin: string): Promise<ETFAllocation | null> => {
    try {
      const { data, error } = await supabase
        .from('etf_allocations')
        .select('*')
        .eq('isin', isin)
        .maybeSingle();
      
      if (error || !data) {
        console.log(`No DB cache found for ETF ${isin}`);
        return null;
      }
      
      console.log(`[ETF] Loaded from DB cache: ${isin}`);
      
      return {
        isin: data.isin,
        name: data.name || '',
        countryAllocations: (data.country_allocations as Record<string, number>) || {},
        currencyAllocations: (data.currency_allocations as Record<string, number>) || {},
        sectorAllocations: (data.sector_allocations as Record<string, number>) || {},
        topHoldings: (Array.isArray(data.top_holdings) ? data.top_holdings as unknown as ETFTopHolding[] : []),
        isHedged: data.is_hedged || false,
        cached: true,
        fromDbFallback: true,
      };
    } catch (err) {
      console.error(`Error fetching ETF from DB cache:`, err);
      return null;
    }
  }, []);

  const fetchAllocation = useCallback(async (isin: string, forceRefresh = false): Promise<ETFAllocation | null> => {
    // Return cached if available and not forcing refresh
    if (!forceRefresh && allocations[isin]) {
      // Check if cached but missing sector data - if so, force a refresh
      const hasNoSectors = Object.keys(allocations[isin].sectorAllocations || {}).length === 0;
      
      if (hasNoSectors) {
        console.log(`${isin} has no sector data in local cache, forcing refresh`);
        forceRefresh = true;
      } else {
        return allocations[isin];
      }
    }

    // Skip if already loading
    if (loading[isin]) {
      return null;
    }

    setLoading(prev => ({ ...prev, [isin]: true }));
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[isin];
      return newErrors;
    });

    try {
      const { data, error } = await supabase.functions.invoke('fetch-etf-allocation', {
        body: { isin, forceRefresh },
      });

      if (error) {
        throw new Error(error.message);
      }

      const allocation: ETFAllocation = {
        isin: data.isin,
        name: data.name,
        countryAllocations: data.countryAllocations,
        currencyAllocations: data.currencyAllocations,
        sectorAllocations: data.sectorAllocations || {},
        topHoldings: data.topHoldings || [],
        isHedged: data.isHedged,
        cached: data.cached,
      };

      setAllocations(prev => ({ ...prev, [isin]: allocation }));
      return allocation;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch ETF allocation';
      console.warn(`Edge function failed for ${isin}, trying DB fallback...`);
      
      // FALLBACK: Try to load from DB cache
      const dbCached = await fetchFromDbCache(isin);
      if (dbCached) {
        setAllocations(prev => ({ ...prev, [isin]: dbCached }));
        // Show toast only once per session (check if we already showed it)
        if (!errors['__fallback_toast_shown']) {
          toast({
            title: 'Dati ETF da cache',
            description: 'Backend non disponibile, uso dati salvati.',
            variant: 'default',
          });
          setErrors(prev => ({ ...prev, '__fallback_toast_shown': 'true' }));
        }
        return dbCached;
      }
      
      setErrors(prev => ({ ...prev, [isin]: message }));
      console.error(`Error fetching ETF allocation for ${isin}:`, error);
      return null;
    } finally {
      setLoading(prev => ({ ...prev, [isin]: false }));
    }
  }, [allocations, loading, fetchFromDbCache, errors]);

  const fetchMultipleAllocations = useCallback(async (isins: string[]): Promise<Record<string, ETFAllocation>> => {
    const results: Record<string, ETFAllocation> = {};
    
    // Fetch in parallel but with some throttling
    const batchSize = 3;
    for (let i = 0; i < isins.length; i += batchSize) {
      const batch = isins.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(isin => fetchAllocation(isin))
      );
      
      batchResults.forEach((result, index) => {
        if (result) {
          results[batch[index]] = result;
        }
      });
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < isins.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return results;
  }, [fetchAllocation]);

  return {
    allocations,
    loading,
    errors,
    fetchAllocation,
    fetchMultipleAllocations,
  };
}
