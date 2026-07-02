import { useQuery } from '@tanstack/react-query';
import { usePortfolioContext, isAnyAggregatedId } from '@/contexts/PortfolioContext';
import { fetchFullSnapshot, FullSnapshot } from '@/lib/fullSnapshot';

/**
 * Snapshot completo del portafoglio per la data della Visualizzazione Storica.
 * Attivo solo quando la vista storica è attiva su un portafoglio singolo.
 * Query key condivisa: tutti gli hook che leggono da qui (positions, configs,
 * overrides, GP) usano la stessa cache entry.
 */
export function useFullSnapshot() {
  const { selectedPortfolioId, historicalViewDate, isHistoricalView } = usePortfolioContext();
  const enabled = isHistoricalView
    && !!historicalViewDate
    && !!selectedPortfolioId
    && !isAnyAggregatedId(selectedPortfolioId);

  const query = useQuery<FullSnapshot | null>({
    queryKey: ['full-snapshot', selectedPortfolioId, historicalViewDate],
    queryFn: async () => {
      if (!selectedPortfolioId || !historicalViewDate) return null;
      return fetchFullSnapshot(selectedPortfolioId, historicalViewDate);
    },
    enabled,
    staleTime: 5 * 60 * 1000, // lo storico non cambia
  });

  return {
    snapshot: query.data ?? null,
    isLoading: enabled && query.isLoading,
    isHistoricalActive: enabled,
  };
}
