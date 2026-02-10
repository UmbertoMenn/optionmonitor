

## Fix: Mostrare il triangolino rosso quando il mercato e chiuso

### Problema
Il triangolino rosso (`StalePriceIndicator`) viene mostrato **solo** quando `isStale === true` (prezzo aggiornato da piu di 10 minuti). Ma il cron job aggiorna i prezzi anche a mercato chiuso (usando il `previousClose` da Finnhub o l'ultimo prezzo Yahoo), quindi `updated_at` viene sempre refreshato e `isStale` resta `false`. Di conseguenza il componente non viene mai renderizzato a mercato chiuso.

Il componente `StalePriceIndicator` contiene gia la logica per distinguere "Mercato chiuso" da "Prezzo non aggiornato" nel tooltip, ma non viene mai montato perche la condizione di rendering lo impedisce.

### Soluzione

Modificare la condizione di rendering in `Derivatives.tsx`: mostrare l'indicatore sia quando il prezzo e stale, sia quando il mercato di riferimento e chiuso.

**File: `src/pages/Derivatives.tsx`**

In tutte le ~8 occorrenze dove compare:
```tsx
{underlyingPrices[underlying]?.isStale && (
  <StalePriceIndicator ticker={underlyingPrices[underlying]?.ticker} />
)}
```

Cambiare in:
```tsx
{(underlyingPrices[underlying]?.isStale || 
  (underlyingPrices[underlying]?.ticker && !isMarketOpen(underlyingPrices[underlying]!.ticker!))) && (
  <StalePriceIndicator ticker={underlyingPrices[underlying]?.ticker} />
)}
```

E aggiungere l'import di `isMarketOpen` da `@/lib/marketHours` in cima al file.

Lo stesso pattern si applica alle righe che usano `option.underlying` come chiave (Covered Call, Naked Put, Protezioni, Leap Call).

### Comportamento risultante
- **Mercato chiuso**: triangolino rosso con tooltip "Mercato chiuso"
- **Mercato aperto ma prezzo stale (>10 min)**: triangolino rosso con tooltip "Prezzo non aggiornato"
- **Mercato aperto e prezzo fresco**: nessun indicatore

### File coinvolti
1. `src/pages/Derivatives.tsx` -- aggiungere import `isMarketOpen` + modificare ~8 condizioni di rendering

