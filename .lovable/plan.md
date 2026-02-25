

## Piano: 4 correzioni alla calcolatrice premi

### 1. Deduplicazione ordini — sostituzione, non somma

**Problema:** quando si carica un Excel con operazioni già presenti nella calcolatrice, la funzione `mergeOrders` aggiunge solo le nuove (via `orderKey`), ma il `orderKey` attuale usa `validityDate` raw che potrebbe avere differenze di formato tra dati salvati e nuovi.

**Soluzione in `src/lib/orderFileParser.ts`:**
- Normalizzare `validityDate` nell'`orderKey` usando `toIsoDateFromIT` prima del confronto, così `'15/01/2025'` e `'15/01/2025'` (con eventuali spazi o apostrofi) producono la stessa chiave.

```typescript
export function orderKey(o: ParsedOrder): string {
  const normalizedDate = toIsoDateFromIT(o.validityDate) || o.validityDate || '';
  return `${o.symbol}|${o.operation}|${o.avgPrice}|${o.quantity}|${normalizedDate}`;
}
```

### 2. Badge CALL accanto al simbolo (come il badge PUT)

**File: `src/components/derivatives/CallPremiumCalculatorDialog.tsx`**

Nella tabella operazioni (riga ~596-601), aggiungere un badge CALL simmetrico al badge PUT esistente:

```tsx
<TableCell className="text-xs font-mono">
  {order.symbol}
  {order.optionType === 'PUT' && (
    <Badge variant="outline" className="text-[10px] ml-1 px-1 py-0">PUT</Badge>
  )}
  {order.optionType === 'CALL' && (
    <Badge variant="outline" className="text-[10px] ml-1 px-1 py-0">CALL</Badge>
  )}
</TableCell>
```

### 3. Colonna "Data operazione" nel riepilogo operazioni

**File: `src/components/derivatives/CallPremiumCalculatorDialog.tsx`**

Aggiungere una colonna `Data` nell'header della tabella operazioni (dopo `Op.` e prima di `Simbolo`) che mostra la `validityDate` dell'ordine (il campo `Data Validità` dal file Excel).

```tsx
// Header
<TableHead className="text-xs">Data</TableHead>

// Cell
<TableCell className="text-xs text-muted-foreground">
  {order.validityDate || '—'}
</TableCell>
```

### 4. Calcolatrice rossa se manca una gamba della strategia

**Concetto:** per ogni strategia, le posizioni attuali in portafoglio (gambe) devono risultare "aperte" nell'elenco operazioni della calcolatrice. Una posizione è "aperta" se nell'elenco ordini esiste un'operazione con lo stesso ticker/tipo/strike che non è stata chiusa da un'operazione di segno opposto successiva.

**Implementazione:**

a) **Nuova prop per `CallPremiumCalculatorDialog`:** aggiungere `strategyLegs` opzionale — un array di oggetti `{ optionType: 'CALL'|'PUT', strikePrice: number, quantity: number }` che rappresentano le gambe attuali della strategia.

b) **Funzione di verifica in `CallPremiumCalculatorDialog`:** `checkLegsOpenInOrders(legs, orders)`:
   - Per ogni gamba, cercare negli ordini caricati operazioni con lo stesso `optionType` e `strikePrice` (estratto dal simbolo via `extractStrikeFromSymbol`)
   - Calcolare la quantità netta per quella gamba (sell = +, buy = -), considerando solo gli ordini più recenti per determinare se la posizione è ancora aperta
   - Se la quantità netta corrisponde al segno atteso della gamba in portafoglio (es. quantità negativa per vendita), la gamba è "aperta"
   - Se qualsiasi gamba non è trovata o risulta chiusa → `missingLegs = true`

c) **Colore calcolatrice rossa:** nella riga della strategia in `Derivatives.tsx`, passare `strategyLegs` alla calcolatrice. Se il salvato ha ordini ma almeno una gamba manca → l'icona della calcolatrice diventa rossa (destructive).

**Logica dettagliata per "gamba aperta":**
```typescript
function isLegOpenInOrders(
  orders: ParsedOrder[], 
  leg: { optionType: 'CALL'|'PUT', strikePrice: number, quantity: number }
): boolean {
  // Filtra ordini con stesso optionType e strike
  const legOrders = orders.filter(o => {
    const strike = extractStrikeFromSymbol(o.symbol);
    return o.optionType === leg.optionType && strike === leg.strikePrice;
  });
  
  if (legOrders.length === 0) return false;
  
  // Ordina per data validità
  const sorted = [...legOrders].sort((a, b) => {
    const da = toIsoDateFromIT(a.validityDate) || '';
    const db = toIsoDateFromIT(b.validityDate) || '';
    return da.localeCompare(db);
  });
  
  // Calcola quantità netta (sell = +, buy = -)
  let netQty = 0;
  for (const order of sorted) {
    if (order.operation === 'sell') netQty += order.quantity;
    else netQty -= order.quantity;
  }
  
  // La gamba in portafoglio ha quantity negativa se venduta, positiva se comprata
  // Verifica che il segno corrisponda
  if (leg.quantity < 0) return netQty < 0; // venduta → net negativo = aperta
  if (leg.quantity > 0) return netQty > 0; // comprata → net positivo = aperta
  return false;
}
```

**Passaggio `strategyLegs` dai vari Row:**

- **CoveredCallRow:** `[{ optionType: 'CALL', strikePrice: option.strike_price, quantity: option.quantity }]`
- **IronCondorRow:** 4 gambe: soldPut, boughtPut, soldCall, boughtCall
- **DoubleDiagonalRow:** 4 gambe
- **GroupedOtherStrategyRow:** tutte le opzioni del gruppo
- **NakedPutRow:** `[{ optionType: 'PUT', strikePrice: option.strike_price, quantity: option.quantity }]`

**Colorazione icona:**
```tsx
const hasMissingLegs = savedPremium && savedPremium.orders_json.length > 0 
  ? !strategyLegs.every(leg => isLegOpenInOrders(savedPremium.orders_json, leg))
  : false;

<Calculator className={`w-4 h-4 ${hasMissingLegs ? 'text-red-500' : savedPremium ? 'text-primary' : 'text-muted-foreground'}`} />
```

### Riepilogo modifiche

| File | Modifica |
|------|----------|
| `src/lib/orderFileParser.ts` | Normalizzare `validityDate` in `orderKey`, esportare `extractStrikeFromSymbol` e aggiungere `isLegOpenInOrders` |
| `src/components/derivatives/CallPremiumCalculatorDialog.tsx` | Badge CALL, colonna Data, prop `strategyLegs` |
| `src/pages/Derivatives.tsx` | Passare `strategyLegs` alla calcolatrice, colorare icona se gambe mancanti |

