

## Fix: assegnazioni spezzate dall'espansione unitaria

### Problema
Il loop di espansione (righe 318-323) scompone **ogni** ordine in unità di quantità 1 per il matching FIFO. Questo funziona per le opzioni, ma per le assegnazioni produce 100 leg separate `TSLAx1@440@410` invece di un singolo `TSLAx100@440@410`.

Le opzioni normali non sono toccate — hanno già i punti al posto giusto (riga 352).

### Soluzione
Intercettare le assegnazioni **prima** dell'espansione unitaria, così la quantità originale viene preservata.

**File: `src/lib/optionStratUrl.ts`** — nel loop `for (const [, group] of groups)`, prima dell'espansione:

```typescript
for (const [, group] of groups) {
  // Handle assignments before expansion (preserve original quantity)
  const assignmentOrders = group.filter(o => o.isAssignment && o.assignmentStrike);
  const nonAssignmentOrders = group.filter(o => !(o.isAssignment && o.assignmentStrike));

  for (const order of assignmentOrders) {
    const buyPrice = formatStrike(order.assignmentStrike);
    const sellPrice = formatStrike(order.avgPrice);
    legs.push(`${ticker}x${order.quantity}@${buyPrice}@${sellPrice}`);
  }

  // Expand only non-assignment orders for FIFO matching
  const expanded: ParsedOrder[] = [];
  for (const order of nonAssignmentOrders) {
    for (let i = 0; i < order.quantity; i++) {
      expanded.push({ ...order, quantity: 1 });
    }
  }

  // ... rest of FIFO matching (unchanged)
```

Rimuovere il check `isAssignment` dentro il `while` loop (righe 331-338) dato che ora è gestito prima.

