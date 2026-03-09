

## Fix critico: rimuovere fuzzy match da `resolveTicker`

### 1. Fix `src/lib/strategyCache.ts` — funzione `resolveTicker`

Sostituire la logica fuzzy (righe 38-56) con match rigoroso:

```typescript
function resolveTicker(underlying: string, underlyingPrices: Record<string, UnderlyingPrice>): string | null {
  // 1. Direct match (via underlying_mappings populated map)
  const priceData = underlyingPrices[underlying];
  if (priceData?.ticker) return priceData.ticker;
  
  // 2. Case-insensitive exact match only — NO fuzzy/includes
  const upperUnderlying = underlying.toUpperCase();
  for (const [key, value] of Object.entries(underlyingPrices)) {
    if (key.toUpperCase() === upperUnderlying && value.ticker) return value.ticker;
  }
  
  // 3. Fallback: underlying itself looks like a ticker (1-5 uppercase, optional .XX suffix)
  if (/^[A-Z]{1,5}(\.[A-Z]{1,2})?$/.test(underlying)) return underlying;
  
  return null;
}
```

Il punto chiave: rimuovere `upperKey.includes(upperUnderlying) || upperUnderlying.includes(upperKey)` che causava il match falso con "C".

### File da modificare
- `src/lib/strategyCache.ts` (funzione `resolveTicker`, ~10 righe)

