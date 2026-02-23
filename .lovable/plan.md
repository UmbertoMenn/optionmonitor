

## Fix: Commissioni calcolate per lotto invece che per ordine

### Problema
La riga 654 di `orderFileParser.ts`:
```
const commissions = ordersFound * transactionCost;
```
Calcola le commissioni come **numero di ordini × costo**. Ma il costo è $10 per lotto (contratto), quindi un ordine con quantità 3 dovrebbe generare $30 di commissioni, non $10.

### Soluzione

**File:** `src/lib/orderFileParser.ts`, riga 654

Sostituire:
```ts
const commissions = ordersFound * transactionCost;
```
con:
```ts
const totalLots = parseResult.filteredOrders.reduce((sum, o) => sum + o.quantity, 0);
const commissions = totalLots * transactionCost;
```

Questo somma le quantità di tutti gli ordini filtrati e moltiplica per il costo unitario per lotto.

**File:** `src/components/derivatives/CallPremiumCalculatorDialog.tsx`, riga 467

Aggiornare la label del campo da "Costo unitario transazione (USD)" a "Commissione per lotto (USD)" per chiarezza.

### Nessun altro file da modificare
La funzione `recalculateMetrics` nel dialog ricostruisce un `OrderParseResult` e lo passa a `calculatePremiumMetrics`, che è l'unico punto dove le commissioni sono calcolate. Il fix è centralizzato.

