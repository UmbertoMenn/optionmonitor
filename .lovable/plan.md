

## Nuova Architettura Vista Aggregata Admin

### Principio Guida

Nella vista "Aggregato - Tutti gli Utenti", ogni pagina deve mostrare esclusivamente la **SOMMA dei risultati gia calcolati per i singoli utenti**. Nessun ricalcolo, nessun re-matching, nessuna ri-categorizzazione.

---

### 1. Strategie Derivati: NASCONDERE la pagina

Quando l'admin seleziona l'aggregato globale (`AGGREGATED`), la pagina Strategie Derivati mostra un messaggio informativo che invita a selezionare un singolo portafoglio o un aggregato per-utente.

**File: `src/pages/Derivatives.tsx`**
- All'inizio del render, se `selectedPortfolioId === AGGREGATED_PORTFOLIO_ID`, mostrare una card con messaggio: "La vista Strategie Derivati non e disponibile per l'aggregato globale. Seleziona un singolo portafoglio o l'aggregato di un utente."
- Tutto il resto della pagina non viene renderizzato

---

### 2. Risk Analyzer: Somma per-portfolio

Invece di chiamare `categorizeDerivatives` + `analyzePortfolioRisk` su tutte le posizioni mescolate, eseguire `analyzePortfolioRisk` separatamente per ogni portfolio e sommare i risultati numerici.

**File: `src/hooks/useRiskAnalysis.ts`**

Nuova logica quando `isAggregatedView` e true:

```text
1. Raggruppa positions per portfolio_id
2. Raggruppa overrides per portfolio_id  
3. Per ogni portfolio:
   a. Applica toSnapshotPositions
   b. categorizeDerivatives(derivati_portfolio, posizioni_portfolio, overrides_portfolio)
   c. analyzePortfolioRisk(posizioni_portfolio, categories_portfolio)
4. Somma tutti i totali (totalStockRisk, totalCommodityRisk, ecc.)
5. Concatena tutti i detail arrays (stockDetails, strategyDetails, ecc.)
```

Questo richiede che `useRiskAnalysis` sappia se siamo in vista aggregata. Importare `usePortfolioContext` e leggere `isAggregatedView`.

I detail arrays concatenati permettono alle viste (Equity, Currency, Sector) di funzionare correttamente con i dati per-holding gia calcolati.

---

### 3. Dashboard: Verifiche

La Dashboard gia funziona prevalentemente con somme tramite `usePortfolio` che aggrega `cash_value` e `total_value`. I calcoli di netting e equity exposure utilizzano pero `useDerivativeNetting` e `useEquityExposurePct` che soffrono dello stesso problema (categorizzazione su posizioni mescolate).

**File: `src/hooks/useEquityExposurePct.ts`**
- Stessa logica del Risk Analyzer: se aggregato, eseguire per-portfolio e sommare

**File: `src/hooks/useDerivativeNetting.ts`** (da verificare)
- Se usa `categorizeDerivatives`, applicare la stessa logica per-portfolio

---

### File modificati

| File | Modifica |
|------|----------|
| `src/pages/Derivatives.tsx` | Early return con messaggio informativo se `AGGREGATED_PORTFOLIO_ID` |
| `src/hooks/useRiskAnalysis.ts` | Importare `usePortfolioContext`; se aggregato, eseguire `categorizeDerivatives` + `analyzePortfolioRisk` per-portfolio e sommare risultati |
| `src/hooks/useEquityExposurePct.ts` | Stessa logica per-portfolio se aggregato |
| `src/hooks/useDerivativeNetting.ts` | Verificare e applicare logica per-portfolio se necessario |

### Risultato atteso

- **Strategie Derivati**: pagina oscurata nell'aggregato globale, nessun errore possibile
- **Risk Analyzer**: holdings consolidate, strategie e tutti i dettagli sono la somma esatta dei singoli portafogli
- **Dashboard**: netting e equity exposure calcolati correttamente per-portfolio e sommati

