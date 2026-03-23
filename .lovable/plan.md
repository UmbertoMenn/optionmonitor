

## Fix: Strategy Configurations non vengono applicate nella categorizzazione

### Causa root
Il parametro `strategyConfigs` è stato aggiunto a `categorizeDerivatives()` ma **non viene mai utilizzato** nel corpo della funzione. Il wizard salva le configurazioni nel DB, ma al rendering della pagina Derivati la categorizzazione ignora completamente le configurazioni salvate e usa solo i vecchi override basati su UUID (che si rompono ad ogni upload Excel).

### Soluzione
Implementare lo **Step 0.5** in `categorizeDerivatives` che applica le `strategy_configurations` salvate prima della categorizzazione automatica.

### Logica Step 0.5

Per ogni `StrategyConfiguration` salvata:
1. Trovare tutte le opzioni non ancora classificate con lo stesso `underlying` (normalizzato)
2. In base a `strategy_type`:
   - **`covered_call`**: prendi CALL vendute → classifica come Covered Call, collegandole allo stock
   - **`derisking_covered_call`**: prendi CALL vendute + PUT comprate → classifica come De-Risking CC
   - **`naked_put`**: prendi PUT vendute → classifica come Naked Put
   - **`leap_call`**: prendi CALL comprate → classifica come LEAP Call
   - **`iron_condor`**: tenta match IC standard con le opzioni disponibili
   - **`double_diagonal`**: tenta match DD standard con le opzioni disponibili
   - **`other`** (o qualsiasi altro tipo): raggruppa tutte le opzioni come "Altre Strategie"
3. Se `is_synthetic` è true, flagga la Covered Call come sintetica
4. Se `linked_stock_id` è presente, usa quello stock specifico
5. Marca le opzioni come usate (`usedDerivatives.add`)

Le opzioni **non coperte** da nessuna configurazione salvata continuano attraverso la categorizzazione automatica esistente (Step 1-6).

### File da modificare

1. **`src/lib/derivativeStrategies.ts`** — Aggiungere blocco Step 0.5 tra Step 0 (override manuali) e Step 1 (covered calls automatiche), ~30-50 righe di logica di matching
2. **`src/hooks/usePortfolio.ts`** — Invalidare `['strategy-configurations']` nell'`onSuccess` della mutation di upload (riga 223), per forzare il refresh se le firme cambiano
3. **`src/pages/Derivatives.tsx`** — Verificare che nell'aggregated view le configs vengano passate per-portfolio (attualmente riga 167 non passa `strategyConfigs`)

### Dettaglio Step 0.5 (pseudocodice)

```text
for (config of strategyConfigs) {
  underlying = config.underlying (normalizzato)
  remaining = filteredDerivatives.filter(not used, same underlying)
  
  switch (config.strategy_type):
    'covered_call':
      soldCalls = remaining.filter(call, qty<0)
      stock = config.linked_stock_id ? find by id : findUnderlyingStock
      → push to coveredCalls, mark used
      
    'derisking_covered_call':
      soldCalls + boughtPuts → push to deRiskingCoveredCalls
      
    'iron_condor':
      find 4 legs → push to ironCondors
      
    'double_diagonal':
      find 4 legs → push to doubleDiagonals
      
    'naked_put':
      soldPuts → push to nakedPuts
      
    'leap_call':
      boughtCalls → push to leapCalls
      
    default ('other'):
      all remaining → push to otherStrategies/groupedOtherStrategies
}
```

