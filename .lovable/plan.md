
## Fix Vista Aggregata Derivati: Categorizzazione Per-Portfolio

### Problema Fondamentale

Attualmente, nella vista aggregata (admin), tutte le posizioni di tutti gli utenti vengono mescolate in un unico pool e passate a `categorizeDerivatives()` come se fossero di un unico portafoglio. Questo causa errori perche:

1. **`findUnderlyingStock` trova solo UNA riga stock** -- se User A ha 300 azioni ALPHABET e User B ne ha 600, la funzione matcha una sola call venduta contro i 300 di User A, non i 900 totali
2. **La summary card ri-computa il matching da zero** con logica diversa dal motore di classificazione, duplicando e peggiorando gli errori
3. **Gli override sono cross-portfolio** -- un override di User A viene applicato alle posizioni di User B

### Soluzione: Categorizzazione Per-Portfolio con Merge dei Risultati

Nella vista aggregata, invece di chiamare `categorizeDerivatives` una volta su tutte le posizioni mescolate, eseguirlo **separatamente per ogni portfolio** e poi concatenare i risultati. Ogni portafoglio viene classificato correttamente con i propri stock e le proprie opzioni, e i risultati vengono semplicemente uniti.

### Dettaglio Tecnico

**File: `src/pages/Derivatives.tsx`**

Modificare il `useMemo` di `categories` (riga 118-140):

```text
Logica attuale:
  categories = categorizeDerivatives(ALL_derivatives, ALL_positions, ALL_overrides)

Nuova logica:
  SE vista aggregata:
    1. Raggruppa positions per portfolio_id
    2. Raggruppa overrides per portfolio_id
    3. Per ogni portfolio_id:
       - filtra derivatives e positions di quel portfolio
       - filtra overrides di quel portfolio
       - chiama categorizeDerivatives(derivatives_i, positions_i, overrides_i)
    4. Concatena tutti gli array risultanti (coveredCalls, longPuts, ecc.)
  ALTRIMENTI:
    categorizeDerivatives(derivatives, positions, overrides) -- come ora
```

**File: `src/components/derivatives/DerivativesSummaryCard.tsx`**

Semplificare il calcolo delle call non coperte (righe 124-216). Poiche ora le categories sono gia corrette per-portfolio, il riepilogo puo fidarsi dei risultati:

- Le covered call con `isFullyCovered: false` indicano copertura parziale
- Le sold call finite in `groupedOtherStrategies` senza stock matching sono non coperte
- Non serve piu ri-computare il matching con `getMatchingKey`

Il calcolo viene riscritto per derivare le call non coperte direttamente dalle categories, senza fare matching di nomi.

### File modificati

| File | Modifica |
|------|----------|
| `src/pages/Derivatives.tsx` | Nel `useMemo` di `categories`: se aggregato, esegui `categorizeDerivatives` per-portfolio e concatena i risultati |
| `src/components/derivatives/DerivativesSummaryCard.tsx` | Semplificare il calcolo uncoveredCalls: derivare direttamente dalle categories senza ri-computare il matching dei nomi |

### Risultato atteso

- Ogni portafoglio viene classificato isolatamente con i propri stock e overrides
- I risultati vengono semplicemente sommati
- Le call non coperte riflettono esattamente cio che e gia calcolato dal motore di classificazione
- Nessuna dipendenza da funzioni di normalizzazione nella summary card
