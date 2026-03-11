

## Fix: Mantenere ordine cronologico per le righe di assegnazione

### Problema
Le righe di assegnazione vengono aggiunte in coda alla lista (`...assignmentOrders` alla fine dell'array), invece di essere inserite nella posizione cronologica corretta tra le altre operazioni.

### Soluzione
Eliminare l'array separato `assignmentOrders` e trattare le assegnazioni come ordini normali, inserendoli direttamente in `callOrders` (o `putOrders`) al momento della creazione, nella posizione originale del file. In alternativa, più semplice: mantenere i tre array separati ma nel `filteredOrders` fare un merge unico e poi **non riordinare** — piuttosto, inserire ogni assegnazione nella posizione giusta al momento della creazione.

**Approccio scelto** (minimo impatto): al momento della creazione dell'assegnazione, copiare la `validityDate` dalla vendita titoli corrispondente (già presente nel file). Poi nel `filteredOrders`, dopo il merge dei 3 array, ordinare per `validityDate` preservando l'ordine relativo del file per gli ordini con stessa data. Siccome l'utente vuole l'ordine del file (che è già cronologico decrescente), basta un sort decrescente per `validityDate`.

**Ma attenzione**: l'utente ha detto di NON ordinare. Quindi l'approccio migliore è: non usare un array separato, ma inserire l'assegnazione nella posizione corretta nell'array principale.

### Piano finale

1. **`src/lib/orderFileParser.ts`**: assicurarsi che `buildAssignmentOrder` copi la `validityDate` dal `stockSellOrder`

2. **`src/components/derivatives/CallPremiumCalculatorDialog.tsx`**:
   - Rimuovere lo state `assignmentOrders` separato
   - Quando si crea un'assegnazione (automatica o da selezione utente), inserirla nell'array `callOrders` subito dopo (o prima) della vendita titoli corrispondente, nella stessa posizione in cui si trova nel file
   - In pratica: trovare l'indice della stock sell nel file originale e inserire l'assegnazione subito dopo
   - `filteredOrders` torna a essere semplicemente il merge di callOrders e putOrders senza append separato
   - Aggiornare tutti i riferimenti a `assignmentOrders` (save, load, clear, recalculate)

### File da modificare
- `src/lib/orderFileParser.ts` — verificare che `buildAssignmentOrder` abbia `validityDate` corretta
- `src/components/derivatives/CallPremiumCalculatorDialog.tsx` — eliminare stato separato `assignmentOrders`, inserire assegnazioni inline in `callOrders`

