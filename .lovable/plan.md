

## Fix: Ordinare operazioni per data decrescente nella calcolatrice premi

### Problema
Le operazioni nella tabella della calcolatrice vengono mostrate nell'ordine in cui sono state inserite/parsate, senza alcun ordinamento. L'utente si aspetta di vederle ordinate per data operazione decrescente (più recenti in alto).

### Soluzione
In `src/components/derivatives/CallPremiumCalculatorDialog.tsx`, riga ~89, ordinare `filteredOrders` per `validityDate` decrescente:

```typescript
const filteredOrders = (includePutPremiums ? [...callOrders, ...putOrders] : callOrders)
  .slice()
  .sort((a, b) => (b.validityDate || '').localeCompare(a.validityDate || ''));
```

### File da modificare
- `src/components/derivatives/CallPremiumCalculatorDialog.tsx` — 1 riga

