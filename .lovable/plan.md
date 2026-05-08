## Problema

La pagina `/risk-analyzer` esce completamente vuota (nera in dark mode). Nessun errore in console o nei runtime errors viene riportato a Lovable.

## Causa probabile

In `src/App.tsx` solo `Dashboard` e `AdminPanel` sono protetti da `ErrorBoundary`. `RiskAnalyzer` e `Derivatives` no. Se un hook (es. `useRiskAnalysis`, `useCurrencyExposure`, `useGPHoldings`, `useSectorMappings`) o una funzione di calcolo (`categorizeDerivatives`, `analyzePortfolioRisk`, `calculateSectorExposure`) lancia un'eccezione durante il render, React smonta tutto il sotto-albero senza fallback → schermo vuoto. Non vedendo l'errore, è impossibile sapere chi lancia.

Probabili sorgenti del throw, da fix recenti su snapshot/GP:
- `usePortfolio()` quando `selectedPortfolio` è `null` ma viene letto `portfolio.snapshot_date` (vedi `GpSnapshotMissingBanner`, ma anche logica derivata).
- `analysis.stockDetails` undefined se `useRiskAnalysis` ritorna prima del calcolo (race con i nuovi `invalidateQueries` dopo upload).
- `gpHoldings` non array in qualche edge case (utenti senza GP).

## Piano

### 1. `src/App.tsx`
Avvolgere anche `RiskAnalyzer` e `Derivatives` (e `Simulator`) in `ErrorBoundary`, come già fatto per Dashboard. Così l'utente vede sempre il messaggio d'errore invece dello schermo bianco/nero, e in console viene loggato lo stack.

### 2. `src/pages/RiskAnalyzer.tsx`
Aggiungere guardie difensive per non crollare se i dati arrivano parziali:
- `analysis.stockDetails ?? []`, `nakedPutDetails ?? []`, ecc., dentro il `useMemo` `stocksForSectorMapping`.
- `gpStockHoldings` già filtrato da array, ma confermare che `gpHoldings` sia `[]` di default (già OK in hook).
- Verificare che `summary` possa essere `null` senza far crashare i sotto-componenti (`EquityExposureView`, `CurrencyExposureView`, `SectorAllocationView`).

### 3. Diagnostica mirata
Aggiungere `console.error` su catch nell'`ErrorBoundary` (già presente) e un `console.log('[RiskAnalyzer] mount', { hasPortfolio, isLoading, isCurrencyLoading })` all'inizio della pagina, così se persiste la blank screen, al prossimo reload abbiamo lo stack reale.

### 4. Verifica
Dopo il fix, l'utente ricarica `/risk-analyzer`:
- caso A: la pagina si carica → era un throw transitorio risolto dalle guardie.
- caso B: appare la card di errore dell'`ErrorBoundary` con stack → lo stack ci dice esattamente dove è il bug e procediamo con un fix mirato.

## File toccati

- `src/App.tsx` (wrap routes in ErrorBoundary)
- `src/pages/RiskAnalyzer.tsx` (guardie difensive + log diagnostico)

Nessuna modifica DB / RLS / business logic.
