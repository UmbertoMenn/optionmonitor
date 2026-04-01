

## Piano: Rimuovere auto-classificazione dalla pagina Derivati + Wizard obbligatorio dopo upload

### Contesto
Attualmente `categorizeDerivatives()` in `derivativeStrategies.ts` ha due percorsi:
1. **Step 0.5**: Applica le `strategy_configurations` salvate (configurazione manuale)
2. **Steps 1-6**: Auto-classificazione euristica (Covered Call per stock match, protezioni per PUT comprate, Iron Condor per 4 gambe, ecc.)

Questi due percorsi conflittano: l'auto-classificazione può assegnare posizioni a categorie diverse da quelle configurate manualmente. La richiesta è:
- **Nella pagina Derivati**: usare SOLO la configurazione manuale
- **Nel Wizard**: mantenere l'auto-classificazione come suggerimento iniziale
- **Dopo upload Excel**: se manca la configurazione o ci sono cambiamenti, aprire il wizard come passaggio obbligato

### Modifiche previste

#### 1. `src/lib/derivativeStrategies.ts` — Aggiungere modalità "config-only"
- Aggiungere un parametro opzionale `configOnly?: boolean` a `categorizeDerivatives()`
- Quando `configOnly = true`: eseguire SOLO Step 0 (overrides) e Step 0.5 (strategy configs), poi saltare Steps 1-6
- Le posizioni non matchate dalle configurazioni finiscono tutte in "Altre Strategie" (Step 6.5 + 7)
- Quando `configOnly = false` (default): comportamento attuale invariato (usato dal Wizard per suggerimenti)

#### 2. `src/pages/Derivatives.tsx` — Usare modalità config-only
- Passare `configOnly: true` nelle chiamate a `categorizeDerivatives()` (sia vista singola che aggregata)
- Il Wizard continua a usare la modalità default (auto-classificazione per suggerimenti)

#### 3. `src/pages/Derivatives.tsx` — Wizard obbligatorio dopo upload
- Aggiungere un effetto che rileva quando:
  - a) Ci sono derivati ma `hasConfigurations === false` → apri wizard automaticamente
  - b) Ci sono derivati nuovi non coperti da nessuna configurazione → apri wizard automaticamente
- Questa logica sostituisce/integra l'attuale reconciliation check
- Usare un flag `needsWizard` calcolato come: "ci sono derivati e (nessuna config OPPURE ci sono posizioni derivative non matchate da nessuna firma salvata)"

#### 4. `src/components/dashboard/FileUploader.tsx` — Redirect al wizard dopo upload
- Dopo upload con successo, se il portafoglio ha derivati:
  - Navigare a `/derivatives` con un query param `?wizard=1`
- In `Derivatives.tsx`: leggere il query param e aprire il wizard se presente

#### 5. Consumatori downstream (nessun cambio di comportamento)
- `useRiskAnalysis.ts`, `uploadSnapshot.ts`, `refreshStrategyCache.ts`, `stagingCalculator.ts`, `useDerivativeNetting.ts` — tutti chiamano `categorizeDerivatives()` con le configs già passate
- Questi moduli continueranno a usare la modalità default (con auto-classificazione) perché hanno bisogno di classificare TUTTE le posizioni per calcoli di rischio, anche quelle non configurate
- Il cambio è solo visivo: la pagina Derivati mostra solo ciò che è configurato

### Dettaglio tecnico

```typescript
// derivativeStrategies.ts — nuovo parametro
export function categorizeDerivatives(
  derivatives: Position[],
  allPositions: Position[],
  overrides: DerivativeOverride[] = [],
  strategyConfigs: StrategyConfiguration[] = [],
  options?: { configOnly?: boolean }
): DerivativeCategories {
  // ... Step 0 (overrides) e Step 0.5 (configs) come ora ...
  
  if (options?.configOnly) {
    // Skip Steps 1-6: tutte le posizioni non usate → Altre Strategie
    const orphans = filteredDerivatives.filter(d => !usedDerivatives.has(d.id));
    for (const opt of orphans) {
      otherStrategies.push({ option: opt, underlying: ... });
    }
    const groupedOtherStrategies = groupOtherStrategiesByUnderlying(otherStrategies);
    return { coveredCalls, deRiskingCoveredCalls, longPuts, ironCondors, 
             doubleDiagonals, nakedPuts, leapCalls, otherStrategies, groupedOtherStrategies };
  }
  
  // Steps 1-6 invariati (usati dal Wizard e dai moduli di rischio)
}
```

```typescript
// Derivatives.tsx — uso config-only
const raw = categorizeDerivatives(derivatives, positions, overrides, strategyConfigs, { configOnly: true });

// Derivatives.tsx — auto-open wizard
const uncoveredDerivatives = useMemo(() => {
  // Conta derivati non coperti da nessuna firma di configurazione
  return derivatives.filter(d => !isMatchedByAnyConfig(d, strategyConfigs));
}, [derivatives, strategyConfigs]);

useEffect(() => {
  if (!isLoading && derivatives.length > 0 && (!hasConfigurations || uncoveredDerivatives.length > 0)) {
    setWizardOpen(true);
  }
}, [isLoading, derivatives.length, hasConfigurations, uncoveredDerivatives.length]);
```

```typescript
// FileUploader.tsx — redirect dopo upload
const hasDerivatives = positions.some(p => p.asset_type === 'derivative');
if (hasDerivatives) {
  navigate('/derivatives?wizard=1');
}
```

### Riepilogo file toccati
| File | Modifica |
|---|---|
| `src/lib/derivativeStrategies.ts` | Aggiungere parametro `configOnly` |
| `src/pages/Derivatives.tsx` | Usare `configOnly: true`, auto-open wizard se config mancante/incompleta |
| `src/components/dashboard/FileUploader.tsx` | Redirect a `/derivatives?wizard=1` dopo upload con derivati |

