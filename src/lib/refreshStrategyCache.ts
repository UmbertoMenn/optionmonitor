import { supabase } from '@/integrations/supabase/client';
import { Position } from '@/types/portfolio';
import { DerivativeOverride } from '@/types/derivativeOverrides';
import { categorizeDerivatives } from './derivativeStrategies';
import { saveStrategyCache } from './strategyCache';
import { UnderlyingPrice } from '@/hooks/useUnderlyingPrices';
import { buildDynamicAliasMap, canonicalKeyForPosition, canonicalKeyForText, DynamicAliases } from './tickerIdentity';

/**
 * Esclude dai derivati quelli il cui sottostante è archiviato.
 *
 * Il wizard archivia salvando la CHIAVE CANONICA (canonicalKeyForPosition):
 * il confronto usa la stessa identica risoluzione, alias dinamici inclusi.
 * Il confronto raw (testo uppercased) resta come fallback per chiavi legacy
 * in formato testuale salvate prima della canonicalizzazione.
 *
 * Funzione pura, esportata per i test.
 */
export function filterArchivedDerivatives(
  derivatives: Position[],
  archivedUnderlyingKeys: string[],
  dynamicAliases: DynamicAliases,
): Position[] {
  const archivedRawKeys = new Set<string>();
  const archivedCanonicalKeys = new Set<string>();
  for (const k of archivedUnderlyingKeys) {
    const trimmed = (k || '').trim();
    if (!trimmed) continue;
    archivedRawKeys.add(trimmed.toUpperCase());
    archivedCanonicalKeys.add(canonicalKeyForText(trimmed, dynamicAliases));
  }
  if (archivedCanonicalKeys.size === 0 && archivedRawKeys.size === 0) return derivatives;
  return derivatives.filter(d => {
    if (archivedCanonicalKeys.has(canonicalKeyForPosition(d, dynamicAliases))) return false;
    const rawKey = (d.underlying || d.description || '').toUpperCase().trim();
    return !archivedRawKeys.has(rawKey);
  });
}

/**
 * Refreshes the strategy_cache for a portfolio after an Excel upload.
 * Fetches positions, overrides and underlying prices from the DB,
 * runs categorization, and saves the cache.
 * 
 * This ensures the check-alerts cron always sees up-to-date strikes.
 * Runs in the background (fire-and-forget).
 */
export async function refreshStrategyCacheForPortfolio(portfolioId: string): Promise<void> {
  try {
    // 1. Fetch all positions for this portfolio
    const { data: positionsRaw, error: posErr } = await supabase
      .from('positions')
      .select('*')
      .eq('portfolio_id', portfolioId);

    if (posErr || !positionsRaw) {
      console.error('[refreshStrategyCache] Error fetching positions:', posErr);
      return;
    }

    const positions = positionsRaw as unknown as Position[];
    const derivatives = positions.filter(p => p.asset_type === 'derivative');

    if (derivatives.length === 0) {
      // No derivatives → clear cache
      await supabase.from('strategy_cache').delete().eq('portfolio_id', portfolioId);
      console.log('[refreshStrategyCache] No derivatives, cache cleared');
      return;
    }

    // 1a. Fetch underlying mappings FIRST: servono sia per gli alias dinamici
    // (identità canonica di archiviati e categorizzazione) sia per la mappa
    // prezzi keyed-by-name più sotto.
    const { data: mappingsRaw } = await supabase
      .from('underlying_mappings')
      .select('underlying, ticker');
    const dynamicAliases = buildDynamicAliasMap(
      (mappingsRaw || []) as Array<{ underlying: string; ticker: string }>,
    );

    // 1b. Fetch archived underlyings for this portfolio (to exclude from cache)
    const { data: archivedRaw } = await supabase
      .from('archived_underlyings')
      .select('underlying_key')
      .eq('portfolio_id', portfolioId);
    const archivedUnderlyingKeys = ((archivedRaw || []) as Array<{ underlying_key: string }>)
      .map(a => a.underlying_key);

    // Filter out archived derivatives — match canonico autoritativo, raw come fallback
    const activeDerivatives = filterArchivedDerivatives(derivatives, archivedUnderlyingKeys, dynamicAliases);

    if (activeDerivatives.length === 0) {
      await supabase.from('strategy_cache').delete().eq('portfolio_id', portfolioId);
      console.log('[refreshStrategyCache] All derivatives archived, cache cleared');
      return;
    }

    // 2. Fetch derivative overrides
    const { data: overridesRaw } = await supabase
      .from('derivative_overrides')
      .select('*')
      .eq('portfolio_id', portfolioId);

    const overrides = (overridesRaw || []) as unknown as DerivativeOverride[];

    // 3. Fetch underlying prices
    const { data: pricesRaw } = await supabase
      .from('underlying_prices')
      .select('*');

    // 4. Build the prices map keyed by underlying name (mappings già caricati allo step 1a)
    const tickerToUnderlying = new Map<string, string>();
    (mappingsRaw || []).forEach((m: any) => {
      tickerToUnderlying.set(m.ticker.toUpperCase(), m.underlying);
    });

    // Build underlyingPrices map: keyed by underlying name
    const underlyingPrices: Record<string, UnderlyingPrice> = {};
    (pricesRaw || []).forEach((p: any) => {
      const ticker = p.ticker as string;
      const price: UnderlyingPrice = {
        price: p.price,
        currency: p.currency,
        ticker,
        updatedAt: p.updated_at,
        isStale: false,
      };

      // Map by ticker directly
      underlyingPrices[ticker] = price;

      // Also map by underlying name if mapping exists
      const underlyingName = tickerToUnderlying.get(ticker.toUpperCase());
      if (underlyingName) {
        underlyingPrices[underlyingName] = price;
      }
    });

    // 5. Fetch strategy configurations
    const { data: configsRaw } = await supabase
      .from('strategy_configurations')
      .select('*')
      .eq('portfolio_id', portfolioId);
    const strategyConfigs = (configsRaw || []) as any[];

    // 6. Categorize (config-only: no orphan fallback) and save.
    // dynamicAliases DEVE essere passato: la UI (Derivatives.tsx) categorizza
    // con gli alias dinamici, e la cache letta dal cron deve produrre lo
    // stesso identico risultato — altrimenti i sottostanti risolvibili solo
    // via underlying_mappings vengono raggruppati/matchati diversamente.
    const categories = categorizeDerivatives(activeDerivatives, positions, overrides, strategyConfigs, { configOnly: true, dynamicAliases });
    await saveStrategyCache(portfolioId, categories, underlyingPrices);

    console.log('[refreshStrategyCache] Cache refreshed for portfolio', portfolioId);
  } catch (err) {
    console.error('[refreshStrategyCache] Unexpected error:', err);
  }
}
