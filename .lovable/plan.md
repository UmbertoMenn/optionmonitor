

## Fix: Performance del Wizard "Riconfigura strategie"

### Causa root del rallentamento

In `restoreFromConfigs` (riga 417-419), per ogni config viene eseguito:
```
allAvailable.filter(p => {
  const derivsOnly = allAvailable.filter(pp => pp.asset_type === 'derivative');  // ← O(n) DENTRO un O(n)
  return getUnderlyingKey(p, derivsOnly) === configUnderlyingKey;  // ← getUnderlyingKey fa un altro O(n) loop
});
```

Questo è **O(n³)** — con 200+ posizioni, la pagina si blocca.

Lo stesso pattern esiste in `underlyingGroups` (riga 375-376) dove `derivsOnly` viene ricalcolato per ogni posizione.

### Soluzione

**File: `src/components/derivatives/StrategyConfigWizard.tsx`**

1. **`restoreFromConfigs`**: estrarre `derivsOnly` una sola volta fuori dal loop, e pre-calcolare una mappa `positionId → underlyingKey` per tutte le posizioni. Poi il filtro per config diventa un semplice lookup O(1).

2. **`underlyingGroups` useMemo**: stessa cosa — calcolare `derivsOnly` una volta, non dentro il loop.

Codice corretto:

```typescript
// restoreFromConfigs — pre-compute derivsOnly and key map
const derivsOnly = allAvailable.filter(pp => pp.asset_type === 'derivative');
const keyMap = new Map<string, string>();
for (const p of allAvailable) {
  keyMap.set(p.id, getUnderlyingKey(p, derivsOnly));
}

for (const config of existingConfigs) {
  const configUnderlyingKey = getCanonicalKey(config.underlying) || normalizeForMatching(config.underlying);
  const groupPositions = allAvailable.filter(p => keyMap.get(p.id) === configUnderlyingKey);
  // ... rest unchanged
}
```

```typescript
// underlyingGroups useMemo — extract derivsOnly once
const derivsOnly = allAvailable.filter(p => p.asset_type === 'derivative');
for (const p of allAvailable) {
  const key = getUnderlyingKey(p, derivsOnly);  // now O(n) total instead of O(n²)
  // ...
}
```

Complessità: da O(n³) a O(n²) nel caso peggiore, O(n) nel caso medio.

### File da modificare
- `src/components/derivatives/StrategyConfigWizard.tsx` — ottimizzazione `restoreFromConfigs` + `underlyingGroups`

