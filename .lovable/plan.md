

## Fix Netting Dashboard: usa esattamente le posizioni di Strategie Derivati + colonna "Posizioni orfane"

### Causa del mismatch attuale

`useDerivativeNetting` chiama `categorizeDerivatives` **senza** `configOnly`, quindi esegue auto-classificazione euristica (STEP 1-6) + STEP 6.5 (orfani su underlying configurati → "Altre Strategie"). La pagina Derivati invece usa `configOnly: true` e mostra solo ciò che matcha le config salvate.

Risultato: una covered call sintetica GOOGLE (configurata correttamente) nella dashboard può finire spezzata tra la categoria corretta + un orfano in "Altre Strategie", oppure WDC/ORACLE classificati in modo diverso tra le due pagine.

### Fix in 3 punti come richiesto

**1) Stessa fonte dati di Strategie Derivati**

In `src/hooks/useDerivativeNetting.ts` (sia `computeSinglePortfolioNetting` riga ~85 sia `getBreakdownForViewMode` riga ~425):

```ts
const categories = categorizeDerivatives(
  derivatives, positions, overrides, strategyConfigs,
  { configOnly: true }
);
```

Sempre `configOnly: true`, identico alla pagina Derivati. Niente fallback condizionale: se l'utente non ha config, le 9 categorie strategiche sono vuote e tutto finisce in "Posizioni orfane" (vedi punto 3). Questo è coerente con la richiesta "PRENDI ESATTAMENTE LE POSIZIONI DI STRATEGIE DERIVATI, SENZA STORIE".

**2) Calcoli per sezione (regola netting ex CC e NP invariata)**

La logica di calcolo per ciascuna delle 9 sezioni resta quella già documentata in `tech/risk-management/netting-logic`:
- `Netting Totale`: market value pieno per tutte le sezioni
- `Netting ex CC e NP`: per Covered Call, De-Risking CC, Naked Put → solo perdita intrinseca se ITM (capped); per le altre 6 sezioni → market value pieno

Nessuna modifica a questa parte: già corretta, continua a funzionare sui dati di `categories` (ora identici a Derivati).

**3) Nuova categoria "Posizioni orfane"**

Le posizioni orfane sono i derivati presenti nel portafoglio ma NON inclusi in nessuna delle 9 categorie restituite da `categorizeDerivatives({ configOnly: true })`.

Implementazione:

a) **In `useDerivativeNetting.ts`**: dopo aver ottenuto `categories`, calcolare l'insieme degli ID dei derivati classificati raccogliendoli da tutte le 9 sezioni. Gli orfani sono `derivatives.filter(d => !classifiedIds.has(d.id))`.

b) Aggiungere al breakdown una 10ª voce `orphans` con:
   - `nettingTotal`: somma `market_value` di tutti gli orfani
   - `nettingExCCNP`: stesso valore (sono "altre strategie" → market value pieno per entrambe le viste)
   - `byUnderlying`: raggruppamento per ticker risolto (per i tooltip), come già fatto per le altre sezioni

c) **Nel tipo del breakdown** (probabilmente in `useDerivativeNetting.ts` o in un file di tipi adiacente): aggiungere campo `orphans` accanto a `coveredCalls`, `deRiskingCC`, `ironCondors`, ecc.

d) **In `HistoricalChartsCarousel.tsx` / `DynamicPortfolioChart.tsx`** (la card che renderizza il grafico a barre verticali): aggiungere "Posizioni orfane" come 10ª colonna dopo "Altre Strategie", con stesso pattern (nascosta se valore = 0, tooltip per ticker, colore distinto — es. grigio/ambra per segnalare visivamente che sono non configurate).

### File da modificare

1. **`src/hooks/useDerivativeNetting.ts`**:
   - Forzare `{ configOnly: true }` in entrambe le chiamate a `categorizeDerivatives`
   - Calcolare lista orfani (derivati non presenti in nessuna delle 9 categorie)
   - Aggiungere campo `orphans` al breakdown ritornato (con `nettingTotal`, `nettingExCCNP`, `byUnderlying`)
   - Includere `orphans.nettingTotal` / `orphans.nettingExCCNP` nei totali aggregati

2. **Componente grafico netting carousel** (da identificare tra `HistoricalChartsCarousel` e `DynamicPortfolioChart`): aggiungere la 10ª colonna "Posizioni orfane" con stesso template delle altre.

### Effetto atteso per Mauro G

- "Altre Strategie" mostra SOLO la short call SMCI 38 maggio (l'unica configurata in quella sezione)
- GOOGLE deep ITM correttamente nella colonna "De-Risking CC" o "Covered Call" (dove configurato), niente duplicazione
- WDC, ORACLE, META, IonQ nelle rispettive sezioni configurate (LEAP Call, Naked Put, ecc.)
- Eventuali derivati realmente non configurati appaiono nella nuova colonna "Posizioni orfane" con dettaglio ticker nel tooltip
- Coerenza 1:1 tra dashboard netting e pagina Strategie Derivati (stesso dataset di partenza)

