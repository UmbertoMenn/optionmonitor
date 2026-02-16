

## Fix: Calcolo P/L sulla riga strategia

### Problema

Il P/L attuale usa `profit_loss` dal broker (basato su avg_cost), ma la formula corretta e':

```
P/L = Valore Calcolatrice (net_per_share) + Valore di Mercato Posizioni Aperte
```

Dove il valore di mercato e': `(prezzo_mercato_opzioni_comprate x contratti x 100) - (prezzo_mercato_opzioni_vendute x contratti x 100)`

Equivale a: `net_per_share + SUM(current_price x quantity x 100)` per tutte le gambe (quantity gia' con segno: positivo per comprate, negativo per vendute).

### Modifiche

**File: `src/pages/Derivatives.tsx`**

1. **DoubleDiagonalRow** (~riga 1427-1429): sostituire il calcolo basato su `profit_loss` con il valore di mercato delle posizioni aperte:
```typescript
// PRIMA (errato):
const portfolioPL = (soldPut.profit_loss || 0) + (soldCall.profit_loss || 0) + 
                (boughtPut.profit_loss || 0) + (boughtCall.profit_loss || 0);

// DOPO (corretto):
const marketValuePositions = 
  ((boughtPut.current_price || 0) * Math.abs(boughtPut.quantity) * 100) +
  ((boughtCall.current_price || 0) * Math.abs(boughtCall.quantity) * 100) -
  ((soldPut.current_price || 0) * Math.abs(soldPut.quantity) * 100) -
  ((soldCall.current_price || 0) * Math.abs(soldCall.quantity) * 100);
const totalPL = (hasSavedGP ? savedPremium.net_per_share : 0) + marketValuePositions;
```

2. **OtherStrategyGroupRow** (~riga 1782-1783): stessa logica, calcolando il valore di mercato dalle singole gambe:
```typescript
// PRIMA:
const combinedPL = totalProfitLoss + (hasSavedGP ? savedPremium.net_per_share : 0);

// DOPO:
const marketValuePositions = options.reduce((sum, o) => {
  const mv = (o.option.current_price || 0) * o.option.quantity * 100;
  return sum + mv;
}, 0);
const combinedPL = (hasSavedGP ? savedPremium.net_per_share : 0) + marketValuePositions;
```

### Dettagli tecnici

- `current_price` sulle posizioni derivati contiene il prezzo di mercato aggiornato (delayed 15 min per opzioni)
- `quantity` e' gia' con segno: positivo per le comprate, negativo per le vendute
- Il calcolo del Double Diagonal usa `Math.abs(quantity)` con segno esplicito (+/-) per chiarezza
- Per le Other Strategies, il `quantity * 100` gestisce automaticamente il segno
- Il calcolo dell'Iron Condor (GP, non P/L) non viene modificato in quanto mostra il Gain Potenziale, non il P/L

