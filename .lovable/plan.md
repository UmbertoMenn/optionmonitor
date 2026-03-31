

## Fix: impedire auto-classificazione delle posizioni dopo upload Excel

### Problema
Quando viene caricato un nuovo Excel, `categorizeDerivatives` viene invocato con le nuove posizioni e le vecchie configurazioni. Le posizioni che non matchano le signatures salvate (es. gamba rollata con nuovo strike/scadenza) cadono attraverso gli STEP 1-6 e vengono auto-classificate — creando duplicati o spostando posizioni in categorie diverse da quelle configurate dall'utente.

### Causa tecnica
In `src/lib/derivativeStrategies.ts`, STEP 0.5 consuma solo le posizioni che matchano le `position_signatures` salvate. Le posizioni non matchate (nuova gamba, rollover) passano agli STEP 1-6 (Covered Call auto-detect, Iron Condor auto-detect, ecc.) dove vengono classificate automaticamente, ignorando la configurazione manuale dell'utente.

### Soluzione
Quando `strategyConfigs.length > 0` (modalità strict), le posizioni il cui underlying ha già una configurazione salvata devono essere **escluse** dagli STEP 1-6 di auto-classificazione. Queste posizioni non matchate devono finire direttamente in "Altre Strategie" come posizioni non configurate, in attesa che l'utente le assegni manualmente tramite il wizard o la riconciliazione.

### Modifica

**File: `src/lib/derivativeStrategies.ts`**

Dopo STEP 0.5 (riga ~477), prima di STEP 1:

1. Creare un set di `configuredUnderlyingKeys` — tutti i `normalizeForMatching(config.underlying)` per ogni config
2. In ogni STEP (1-6), prima di processare una posizione, verificare: se `strategyConfigs.length > 0` e la posizione appartiene a un underlying configurato (`configuredUnderlyingKeys.has(underlyingKey)`), **saltare** la posizione
3. A fine STEP 6, raccogliere tutte le posizioni saltate e aggiungerle a `otherStrategies`

```typescript
// After STEP 0.5, before STEP 1
const configuredUnderlyingKeys = new Set(
  strategyConfigs.map(c => normalizeForMatching(c.underlying))
);
const hasStrictConfigs = strategyConfigs.length > 0;
```

Poi in STEP 1 (Covered Calls auto-detect, riga ~480):
```typescript
const soldCalls = filteredDerivatives.filter(d => 
  d.option_type === 'call' && d.quantity < 0 && !usedDerivatives.has(d.id) &&
  !(hasStrictConfigs && configuredUnderlyingKeys.has(normalizeForMatching(d.underlying || d.description)))
);
```

Stesso pattern per STEP 2-6: aggiungere il filtro `!(hasStrictConfigs && configuredUnderlyingKeys.has(...))`.

Infine, dopo STEP 6, raccogliere le posizioni "orfane" di underlying configurati:
```typescript
// STEP 6.5: Unconfigured positions on configured underlyings → Other Strategies
if (hasStrictConfigs) {
  const orphans = filteredDerivatives.filter(d => 
    !usedDerivatives.has(d.id) && 
    configuredUnderlyingKeys.has(normalizeForMatching(d.underlying || d.description))
  );
  for (const opt of orphans) {
    otherStrategies.push({ option: opt, underlying: findUnderlyingStock(opt, stockPositions) || null });
    usedDerivatives.add(opt.id);
  }
}
```

### File da modificare
- `src/lib/derivativeStrategies.ts` — aggiungere guard `configuredUnderlyingKeys` per escludere posizioni configurate dagli STEP 1-6

