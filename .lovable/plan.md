
# Piano: Correggere Calcoli Holdings Consolidate e Cache

## Problemi Identificati

### 1. Cache ETF con Top Holdings Vuote
Nel database, tutti gli ETF hanno `top_holdings: []` vuoto:

| ISIN | Nome ETF | top_holdings |
|------|----------|--------------|
| IE00B4L5Y983 | iShares Core MSCI World | `[]` |
| LU1681048804 | Amundi S&P 500 | `[]` |
| (tutti gli altri) | ... | `[]` |

**Causa**: Il fallback AI per le top holdings è implementato (linee 361-435 di `fetch-etf-allocation`), ma:
- Lo scraping HTML non estrae le holdings correttamente
- L'AI fallback viene chiamato ma la cache non è stata invalidata
- Le date `last_fetched_at: 2020-01-01` indicano cache molto vecchia non aggiornata

### 2. LocalStorage con ID Portfolio Inesistente
Se l'utente ha in localStorage un ID di portfolio cancellato, potrebbe vedere dati vuoti prima che il fallback selezioni il portfolio corretto.

### 3. Matching Nomi Corretto (Non è il Bug)
Ho verificato che la normalizzazione dei nomi funziona:
- Stock: `AZ.ALIBABA GROUP HOLDING LTD` → normalizzato → `ALIBABA GROUP HOLDING`
- Naked PUT: `ALIBABA GROUP HOLDING LTD` → normalizzato → `ALIBABA GROUP HOLDING`

La funzione `isSameHolding()` dovrebbe matchare correttamente.

### 4. Calcoli PUT Corretti nel Database
I valori nel database sono corretti:
- PUT 165: €13.784
- PUT 170: €14.202
- **Totale PUT Alibaba**: €27.986

Non esiste nessuna PUT 190 per Alibaba nel portfolio.

## Correzioni Richieste

### Correzione 1: Invalidare Cache ETF e Forzare Refresh
```sql
-- Invalida la cache per forzare il refetch con AI fallback
UPDATE etf_allocations 
SET last_fetched_at = '2020-01-01',
    top_holdings = '[]'::jsonb
WHERE jsonb_array_length(top_holdings) = 0;
```

### Correzione 2: Pulire LocalStorage Orfano
**File**: `src/contexts/PortfolioContext.tsx`

Aggiungere una pulizia proattiva del localStorage quando l'ID salvato non esiste più:

```typescript
// In useEffect, dopo aver verificato che savedId non esiste
if (!savedExists && savedId) {
  console.log('Removing orphan portfolio ID from localStorage');
  localStorage.removeItem(SELECTED_PORTFOLIO_KEY);
}
```

### Correzione 3: Debug Console per Holdings Consolidate
**File**: `src/lib/sectorExposure.ts`

Aggiungere logging temporaneo per debug:

```typescript
// In calculateConsolidatedTopHoldings, dopo il loop delle nakedPuts
console.log('Naked PUT details:', analysis.nakedPutDetails.map(np => ({
  underlying: np.underlying,
  strike: np.strike,
  riskEUR: np.riskEUR
})));
```

### Correzione 4: Invalidate Query Cache al Login
**File**: `src/contexts/AuthContext.tsx`

Forzare l'invalidazione di tutte le query quando l'utente fa login:

```typescript
// Dopo login success
queryClient.invalidateQueries();
```

## File da Modificare

| File | Modifica |
|------|----------|
| `src/contexts/PortfolioContext.tsx` | Pulire localStorage orfano + logging |
| `src/contexts/AuthContext.tsx` | Invalidare cache dopo login |
| `src/lib/sectorExposure.ts` | Aggiungere debug logging per verificare matching |
| Database | Invalidare cache ETF per forzare refetch |

## Test di Verifica

Dopo le modifiche, l'utente dovrebbe:

1. **Vedere il portfolio corretto** immediatamente dopo il login
2. **Holdings Consolidate per Alibaba** devono mostrare:
   - Stock: ~€14.678 (100 × $175.66 / 1.197)
   - PUT: €27.986 (€13.784 + €14.202)
   - **Totale**: ~€42.664
3. **Badge ETF** visibili quando le top holdings vengono caricate via AI

## Sequenza di Implementazione

1. Pulire localStorage orfano in PortfolioContext
2. Invalidare cache ETF nel database
3. Aggiungere debug logging per verificare il matching
4. Testare con refresh della pagina e verifica calcoli
