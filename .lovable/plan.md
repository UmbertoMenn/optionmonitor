

## Estendere logica P/L giallo oro a Iron Condor e Double Diagonal

### Cosa cambia

Attualmente, quando non ci sono operazioni nella calcolatrice, Iron Condor e Double Diagonal calcolano il P/L come solo valore di mercato (senza considerare il valore ai PMC). Inoltre il colore e' sempre verde/rosso e il tooltip non distingue tra calcolo con e senza calcolatrice.

### Modifiche

**File: `src/pages/Derivatives.tsx`**

#### 1. Iron Condor (`IronCondorRow`) -- righe 1138-1145

Aggiungere il calcolo `avgCostValue` (somma dei PMC delle 4 gambe) e usarlo come fallback:

```
const avgCostValue = 
  ((soldPut.avg_cost || 0) * Math.abs(soldPut.quantity) * 100) +
  ((soldCall.avg_cost || 0) * Math.abs(soldCall.quantity) * 100) +
  ((boughtPut.avg_cost || 0) * Math.abs(boughtPut.quantity) * 100) +
  ((boughtCall.avg_cost || 0) * Math.abs(boughtCall.quantity) * 100);

const totalPL = hasSavedGP
  ? savedPremium.net_per_share + marketValuePositions
  : avgCostValue + marketValuePositions;
```

#### 2. Iron Condor P/L display -- riga 1289

Cambiare il colore da verde/rosso fisso a giallo oro quando non ci sono operazioni:
- Da: `${isPositivePL ? 'text-green-500' : 'text-red-500'}`
- A: `${hasSavedGP ? (totalPL >= 0 ? 'text-green-500' : 'text-red-500') : 'text-yellow-500'}`

#### 3. Iron Condor tooltip -- riga 1295-1296

Cambiare il tooltip per distinguere i due casi:
- Con calcolatrice: "Profit/Loss: flussi di cassa + valore di mercato"
- Senza calcolatrice: "P/L calcolato senza operazioni storiche caricate"

#### 4. Double Diagonal (`DoubleDiagonalRow`) -- righe 1412-1418

Stessa logica: aggiungere `avgCostValue` e usarlo come fallback nel calcolo `totalPL`.

#### 5. Double Diagonal P/L display -- riga 1564

Stessa modifica del colore (giallo oro senza calcolatrice).

#### 6. Double Diagonal tooltip -- riga 1570

Stesso tooltip differenziato.

