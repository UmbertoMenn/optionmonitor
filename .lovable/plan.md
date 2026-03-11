

## Fix: Rimuovere l'ordinamento aggiunto — mantenere ordine originale del file

Il sorting `.sort()` aggiunto nella modifica precedente sta riordinando le operazioni in modo diverso da come arrivano dal file. L'utente vuole che l'ordine resti quello originale del parsing.

### Soluzione

In `src/components/derivatives/CallPremiumCalculatorDialog.tsx`, riga 89-91, rimuovere `.slice().sort(...)`:

```typescript
// Prima (broken)
const filteredOrders = (includePutPremiums ? [...callOrders, ...putOrders] : callOrders)
  .slice()
  .sort((a, b) => (b.validityDate || '').localeCompare(a.validityDate || ''));

// Dopo (mantiene ordine originale)
const filteredOrders = includePutPremiums ? [...callOrders, ...putOrders] : callOrders;
```

### File da modificare
- `src/components/derivatives/CallPremiumCalculatorDialog.tsx` — 1 modifica, righe 89-91

