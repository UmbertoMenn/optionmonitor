

## Fix: Link OptionStrat con FIFO matching e quantita' condizionale

### Problemi identificati

Analizzando i dati reali del CLS Iron Condor, il codice attuale ha due bug:

**Bug 1: `x{qty}` sempre presente** — Il suffisso `x-1` o `x1` appare anche quando la quantita' e' 1. OptionStrat lo richiede solo quando qty > 1.

**Bug 2: Raggruppamento troppo semplicistico** — Il simbolo `CLSG6C350` appare 5 volte nel database (sell, buy, sell, buy, buy con date diverse). Il codice prende solo il primo e l'ultimo ordine, perdendo 3 cicli intermedi di apertura/chiusura.

### Formato corretto (dall'esempio dell'utente)

```text
Posizione aperta comprata:     .CLS260320P230@7
Posizione aperta venduta:      -.CLS260320C300@19
Posizione chiusa (venduta):    -.CLS260320P250@12@13.55
                               (aperta@12, chiusa@13.55)
Posizione venduta qty>1:       -.CLS260320P250x-2@12
Posizione comprata qty>1:      .CLS260320C330x2@11
```

### Soluzione: FIFO matching per simbolo

**File: `src/lib/optionStratUrl.ts`** — riscrittura di `buildOptionStratUrlFromOrders`

Algoritmo:

1. Invertire l'array ordini (da reverse-chrono a cronologico, oldest first)
2. Raggruppare per simbolo
3. Per ogni gruppo, in ordine cronologico, fare FIFO matching:
   - Il primo ordine apre la posizione (la sua `operation` determina il prefisso `-` o vuoto)
   - Il prossimo ordine con operazione opposta chiude la posizione -> formato `@openPrice@closePrice`
   - Se c'e' un terzo ordine, apre un nuovo ciclo, e cosi' via
   - Ordini rimasti senza match = posizioni aperte -> formato `@price`
4. Quantita': aggiungere `x{qty}` solo se qty > 1 (negativo per sell, positivo per buy)

### Esempio con dati reali CLSG6C350 (5 ordini)

Cronologico (oldest first):

| # | Operazione | Prezzo | Data |
|---|---|---|---|
| 1 | sell | 21.7 | 23/12 |
| 2 | buy | 24 | 13/01 |
| 3 | sell | 22.9 | 27/01 |
| 4 | buy | 6.2 | 29/01 |
| 5 | buy | 11.8 | 09/02 |

FIFO matching:
- sell@21.7 apre -> buy@24 chiude -> `-.CLS260220C350@21.7@24`
- sell@22.9 apre -> buy@6.2 chiude -> `-.CLS260220C350@22.9@6.2`
- buy@11.8 apre (nessun match) -> `.CLS260220C350@11.8`

### Esempio completo dall'utente

Input (Iron Condor con roll):
```text
Buy P230@7, Sell P250@12, Buy C330@11, Sell C310@18
Roll: Buy C310@14 (chiude), Sell C300@19 (apre)
Roll: Buy P250@13.55 (chiude), Sell P260@16 (apre)
```

Output atteso:
```
.CLS260320P230@7,-.CLS260320P250@12@13.55,.CLS260320C330@11,-.CLS260320C310@18@14,-.CLS260320C300@19,-.CLS260320P260@16
```

### Codice

```typescript
export function buildOptionStratUrlFromOrders(
  orders: ParsedOrder[],
  ticker: string,
  strategyName: string | null
): string {
  // Reverse to chronological order (oldest first)
  const chronological = [...orders].reverse();

  // Group by symbol
  const groups = new Map<string, ParsedOrder[]>();
  for (const order of chronological) {
    const key = order.symbol;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(order);
  }

  const legs: string[] = [];

  for (const [, group] of groups) {
    // FIFO matching: pair opening with next opposite-direction trade
    const remaining = [...group];

    while (remaining.length > 0) {
      const opening = remaining.shift()!;
      const parsed = parseSymbolTypeAndStrike(opening.symbol);
      if (!parsed) continue;

      const expiry = expiryDateToYYMMDD(opening.expiryDate);
      const isSold = opening.operation === 'sell';
      const prefix = isSold ? '-' : '';
      const openPrice = formatStrike(opening.avgPrice);

      // Quantity: only include if > 1
      let qtyPart = '';
      if (opening.quantity > 1) {
        qtyPart = isSold ? `x-${opening.quantity}` : `x${opening.quantity}`;
      }

      // Look for closing trade (opposite direction)
      const oppositeOp = isSold ? 'buy' : 'sell';
      const closeIdx = remaining.findIndex(o => o.operation === oppositeOp);

      let leg = `${prefix}.${ticker}${expiry}${parsed.type}${formatStrike(parsed.strike)}${qtyPart}@${openPrice}`;

      if (closeIdx !== -1) {
        const closing = remaining.splice(closeIdx, 1)[0];
        const closePrice = formatStrike(closing.avgPrice);
        leg += `@${closePrice}`;
      }

      legs.push(leg);
    }
  }

  const slug = (strategyName && STRATEGY_SLUG_MAP[strategyName]) || 'custom';
  return `https://optionstrat.com/build/${slug}/${ticker}/${legs.join(',')}`;
}
```

### Nessuna modifica ad altri file

La correzione e' interamente nella funzione `buildOptionStratUrlFromOrders` in `src/lib/optionStratUrl.ts`. Le chiamate in `Derivatives.tsx` e `CallPremiumCalculatorDialog.tsx` restano invariate.

