

## Discrepanza P/L tra StatsCards e Grafico Evoluzione Rendimento

### Causa radice

Il grafico e le card usano **formule diverse** per calcolare la giacenza media (denominatore del rendimento %):

**StatsCards** (corretto):
```
giacenza media = media ponderata per il tempo
  (ogni livello di balance pesato per i giorni in cui è rimasto a quel livello)
```

**Grafico** (sbagliato):
```
avgBalance = entry.average_balance   // dal DB, che è SEMPRE 0
fallback → initialValue + cumulativeDeposits / 2   // approssimazione grezza
```

Il campo `average_balance` nella tabella `historical_data` è **sempre 0** per tutti gli snapshot di maurog (e probabilmente per tutti gli utenti). Quindi il grafico usa il fallback `initialValue + deposits/2`, che è una stima grossolana e diversa dalla media ponderata temporale calcolata dinamicamente dalle StatsCards.

### Esempio numerico (maurog, dal 01/07/25, netting ex CC e NP)

| | StatsCards | Grafico |
|---|---|---|
| P/L assoluto | ~19,751 | ~19,751 (uguale) |
| Giacenza media | ~647,000 (time-weighted) | ~669,616 (initial + deposits/2) |
| Rendimento % | **3.05%** | **2.72%** |

Il P/L assoluto è lo stesso perché la formula `valore_attuale - valore_iniziale - versamenti` è identica. La differenza sta solo nel denominatore della %.

### Fix

**File: `src/components/dashboard/charts/PerformanceEvolutionChart.tsx`**

Estrarre la funzione `calculateTimeWeightedAverage` da StatsCards in un modulo condiviso (o duplicarla nel chart), e usarla nel `chartData` memo al posto del fallback `initialValue + cumulativeDeposits / 2`.

Per ogni punto del grafico:
1. Calcolare la giacenza media time-weighted dal primo punto fino a quel punto
2. Usare quella come denominatore per il rendimento %

Concretamente, nel loop `sorted.map(...)` (riga 481):

```typescript
// PRIMA (sbagliato):
const avgBalance = entry.average_balance > 0 
  ? entry.average_balance 
  : initialValue + cumulativeDeposits / 2;

// DOPO (corretto):
const avgBalance = calculateTimeWeightedAverage(
  initialDate, snapshotDate, initialValue, sortedDeposits
).average;
```

E lo stesso per il punto "current" appended (riga 532).

### File da modificare

1. **Creare `src/lib/timeWeightedAverage.ts`** — Estrarre `calculateTimeWeightedAverage` come funzione riutilizzabile
2. **`src/components/dashboard/charts/PerformanceEvolutionChart.tsx`** — Importare e usare la funzione condivisa
3. **`src/components/dashboard/StatsCards.tsx`** — Importare dalla nuova location (refactor, nessun cambio logica)

### Cosa non cambia
- Il P/L assoluto resta identico (stessa formula)
- La logica dei versamenti (filtro per periodo) resta identica
- Il benchmark non è toccato
- Il downsampling non è toccato

### Risultato atteso
- StatsCards mostra +3.05% → il grafico mostra +3.05%
- StatsCards mostra -1.77% → il grafico mostra -1.77%

