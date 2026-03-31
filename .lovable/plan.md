

## Fix: Put comprata riclassificata + Titoli non ripristinati nel Wizard

### Bug 1: Put comprata in de-risking CC → appare come Long Put

**Causa**: In `src/lib/derivativeStrategies.ts`, il case `derisking_covered_call` (linea 366-412) filtra `remaining` usando `normalizeForMatching`, ma il catch-all `filterBySignatures` alla fine del case consuma solo le posizioni che matchano le firme salvate. Il problema è che se la put comprata NON viene matchata dal loop `for (const call of calls)` (es. perché non ci sono abbastanza call), la put resta NON consumata nonostante sia nella configurazione. 

Inoltre, nel case `covered_call` (linea 313-364), c'è una logica di auto-promozione che cerca bought puts per promuovere a de-risking. Se il config è `derisking_covered_call` ma il matching key non corrisponde esattamente, la put non viene consumata e cade nel STEP 4 (Long Puts auto-detection).

**Fix**: Nella funzione `categorizeDerivatives`, nel case `derisking_covered_call`, dopo il loop dei call, consumare TUTTE le bought puts rimaste (non solo quelle shiftate). Attualmente la linea 409 `for (const p of boughtPuts) usedDerivatives.add(p.id)` fa questo, ma solo per le put rimaste dopo gli shift. Il vero fix è assicurarsi che il `filterBySignatures` finale consumi la put se la logica hardcoded non l'ha fatto. Questo già avviene alla linea 410-411. 

Il problema reale è probabilmente che `normalizeForMatching(config.underlying)` ≠ `normalizeForMatching(d.underlying)` per certi ticker. Fix: usare anche `getCanonicalKey` nel filtro `remaining` (linea 302-304), consistente con come il wizard salva le configurazioni.

**File**: `src/lib/derivativeStrategies.ts` — linea 300-305

```typescript
// PRIMA
const configKey = normalizeForMatching(config.underlying);
const remaining = filteredDerivatives.filter(d => 
  !usedDerivatives.has(d.id) && 
  normalizeForMatching(d.underlying || d.description) === configKey
);

// DOPO  
const configKey = getCanonicalKey(config.underlying) || normalizeForMatching(config.underlying);
const remaining = filteredDerivatives.filter(d => {
  if (usedDerivatives.has(d.id)) return false;
  const posKey = getCanonicalKey(d.underlying || d.description) || normalizeForMatching(d.underlying || d.description);
  return posKey === configKey;
});
```

E aggiornare anche `configuredUnderlyingKeys` (linea 484-486) per usare lo stesso matching:

```typescript
const configuredUnderlyingKeys = new Set(
  strategyConfigs.map(c => getCanonicalKey(c.underlying) || normalizeForMatching(c.underlying))
);
const isConfiguredUnderlying = (d: Position) => {
  if (!hasStrictConfigs) return false;
  const k = getCanonicalKey(d.underlying || d.description) || normalizeForMatching(d.underlying || d.description);
  return configuredUnderlyingKeys.has(k);
};
```

### Bug 2: Titoli (stock slots) tornano disponibili alla riapertura del Wizard

**Causa**: In `restoreFromConfigs` (linea 452-462), il restore dei titoli avviene solo se `config.linked_stock_id` è valorizzato. Ma il match cerca `p.id === config.linked_stock_id` oppure `p.id.startsWith(config.linked_stock_id + '__slot_')`. Il problema è che per strategie che NON sono covered call / derisking (es. naked_put, iron_condor), `linked_stock_id` è `null` perché non c'è uno stock nella strategia — questo è corretto.

Ma per covered call e derisking, il `linked_stock_id` DEVE essere salvato. Il bug è che quando il wizard salva, `handleSave` cerca `strategy.positions.find(p => p.asset_type === 'stock')`. Se il titolo è nel pool ma NON è stato aggiunto alla strategia dall'utente (perché il wizard non lo aggiunge automaticamente durante il restore delle config salvate se il `linked_stock_id` non matcha), allora `stockPos` è undefined e `realStockId` diventa `null`.

**Fix** in `restoreFromConfigs`: se il `linked_stock_id` non matcha nessun slot esatto, fare un fallback cercando QUALSIASI stock slot disponibile nello stesso gruppo underlying:

```typescript
// After linked_stock_id check, add fallback
if (config.linked_stock_id) {
  const stockSlot = groupPositions.find(p =>
    !usedIds.has(p.id) &&
    p.asset_type === 'stock' &&
    (p.id === config.linked_stock_id || p.id.startsWith(config.linked_stock_id + '__slot_'))
  );
  if (stockSlot) {
    usedIds.add(stockSlot.id);
    matched.push(stockSlot);
  }
} 
// Fallback: for CC/DRCC strategies, auto-assign first available stock in group
if (!matched.some(p => p.asset_type === 'stock') && 
    (config.strategy_type === 'covered_call' || config.strategy_type === 'derisking_covered_call')) {
  const fallbackStock = groupPositions.find(p => !usedIds.has(p.id) && p.asset_type === 'stock');
  if (fallbackStock) {
    usedIds.add(fallbackStock.id);
    matched.push(fallbackStock);
  }
}
```

### File da modificare
1. **`src/lib/derivativeStrategies.ts`** — Fix matching key per configs + strict guard (linee 300-305, 484-488)
2. **`src/components/derivatives/StrategyConfigWizard.tsx`** — Fallback stock restore nel `restoreFromConfigs` (linee 451-462)

