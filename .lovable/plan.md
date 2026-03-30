

## Rework Netting Bar Charts per Sezione Strategia

### Problema attuale
Il breakdown del netting usa categorie basate su ITM/OTM (cc_itm, cc_otm, np_itm, np_otm, long_put, leap_call, other) anziché sulle sezioni strategia della pagina Derivati. Mancano categorie come de-risking CC, iron condor, double diagonal, put spread, diagonal put spread. Non c'è avviso se mancano le configurazioni.

### Nuovo comportamento

**Netting Totale** — una barra per sezione strategia con valore di mercato:
- Covered Call, De-Risking CC, Iron Condor, Double Diagonal, Naked Put, Put Spread, Diagonal Put Spread, Leap Call, Protezioni, Altre Strategie
- Tooltip: ticker + valore per sottostante
- Sezioni vuote → nessuna barra
- Senza configurazioni → avviso + bottone "Configura strategie" (link a /derivatives)

**Netting ex CC e NP** — stesse sezioni, ma:
- Covered Call, De-Risking CC, Naked Put → solo valore intrinseco di perdita (ITM)
- Tutte le altre → valore di mercato (costo chiusura)
- Stessa logica tooltip/vuote/avviso

### File da modificare

**1. `src/hooks/useDerivativeNetting.ts`**
- Espandere `computeSinglePortfolioNetting` per produrre breakdown con categorie per sezione strategia: `covered_call`, `derisking_cc`, `iron_condor`, `double_diagonal`, `naked_put`, `put_spread`, `diagonal_put_spread`, `leap_call`, `long_put`, `other`
- Tracciare deRiskingCoveredCalls, ironCondors, doubleDiagonals separatamente (attualmente cadono in "other" o non sono distinti)
- Aggiungere set per putSpreads e diagonalPutSpreads dal `groupedOtherStrategies` di `categorizeDerivatives`
- Aggregare details per ticker in ogni categoria
- Aggiornare `getBreakdownForViewMode`:
  - `netting_total`: mostra valore mercato per tutte le sezioni
  - `netting_ex_cc_np`: per covered_call e derisking_cc → solo intrinseco ITM; per naked_put → solo intrinseco ITM; per tutte le altre → valore mercato

**2. `src/components/dashboard/DynamicPortfolioChart.tsx`**
- Aggiungere prop `hasConfigurations` a `DynamicPortfolioChart`
- Aggiornare `PIE_COLORS` con colori per le nuove categorie
- In `NettingBreakdownChart`: se `hasConfigurations === false`, mostrare avviso con testo + bottone "Configura strategie" che naviga a `/derivatives`
- Aggiornare labels nelle barre per matchare i nomi sezioni

**3. `src/components/dashboard/Dashboard.tsx`**
- Importare e chiamare `useStrategyConfigurations` per ottenere `hasConfigurations`
- Passare `hasConfigurations` a `DynamicPortfolioChart`

### Dettaglio tecnico — espansione breakdown

Attualmente il loop in `computeSinglePortfolioNetting` usa solo `coveredCallMap`, `nakedPutMap`, `longPutSet`, `leapCallSet` e tutto il resto va in `other`. Il fix aggiunge:
- `deRiskingCCSet` da `categories.deRiskingCoveredCalls` (tutte le gambe: option + protectionPut + eventuale syntheticPut)
- `ironCondorSet` da `categories.ironCondors` (4 gambe)
- `doubleDiagonalSet` da `categories.doubleDiagonals` (4 gambe)
- Per put_spread e diagonal_put_spread: si riconoscono dal `strategy_type` nelle `otherStrategies`/`groupedOtherStrategies`

Ogni set accumula il nettingValue nella propria categoria di breakdown.

Per il view mode `netting_ex_cc_np`, la funzione `getBreakdownForViewMode` calcola il valore intrinseco solo per le categorie CC-related (covered_call + derisking_cc) e naked_put, lasciando le altre al valore di mercato.

