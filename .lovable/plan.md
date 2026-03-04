

## Bug: `calcAnnualizedPremiumPct` non annualizza

### Problema
Linea 469: `daysDiff = (now - oneYearAgo)` → sempre ~365 giorni → `actualDays = 365` → fattore `365/365 = 1`.

Il risultato è il premio **assoluto** accumulato, non annualizzato. Se in 30 giorni hai incassato 2% netto, la funzione restituisce 2% invece di ~24%.

Questo spiega perché non rolla: con pochi mesi di storia, il premio assoluto è basso e non supera mai la soglia.

### Fix

In `calcAnnualizedPremiumPct`, calcolare `actualDays` come il numero di giorni tra la **prima operazione nel lookback** e `now`, non tra `oneYearAgo` e `now`:

```typescript
// Trova la data della prima operazione nel periodo
const firstAdjDate = /* data del primo adjustment nel lookback */;
const actualDays = (now - firstAdjDate) / msPerDay;
if (actualDays < 1) return 0;
const annualized = premiumPctRaw * (365 / actualDays);
```

### File modificato
- `src/lib/backtestEngine.ts` — solo la funzione `calcAnnualizedPremiumPct` (linee 434-478)

