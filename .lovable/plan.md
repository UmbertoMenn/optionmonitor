

## Piano: Calcolo flussi per Naked Put + Toggle premi PUT nelle Covered Call

### 1. Nuova funzione di filtro PUT in `src/lib/orderFileParser.ts`

Creare `filterAndCalculatePutPremiums(orders, ticker, otherExpiryDates?)` con logica analoga a `filterAndCalculateCallPremiums` ma per PUT, con un filtro addizionale per le protezioni:

**Regole di inclusione/esclusione:**
- **Vendita sola** → includi (naked put premium)
- **Vendita + acquisto + rivendita dello stesso simbolo** → includi (rolling)
- **Acquisto solo** → escludi (protezione)
- **Acquisto + vendita con scadenza anomala** → escludi (protezione)

**Logica "scadenza anomala":** per ogni simbolo PUT che ha sia buy che sell, se la scadenza estratta dal simbolo è significativamente più lontana rispetto alla mediana delle scadenze degli altri ordini PUT nello stesso file (es. >6 mesi di differenza), è una protezione. In alternativa, approccio più semplice: un simbolo è considerato "rolling legittimo" solo se ha almeno una operazione di vendita come **prima** operazione cronologica (sell→buy→sell). Se la prima operazione è un buy, è una protezione comprata e poi chiusa.

**Approccio proposto (più robusto):** per ogni simbolo PUT, controllare se ha almeno una vendita. Se sì, tenerlo. Se ha solo acquisti, escluderlo. Questo è identico alla logica CALL esistente — la stessa `filterAndCalculateCallPremiums` ma filtrata per `optionType === 'PUT'` invece di `'CALL'`.

Per il caso "comprata e venduta con scadenza lontana": aggiungere un controllo sulla scadenza. Calcolare la mediana delle scadenze di tutti gli ordini PUT con vendita. Se un simbolo ha sell+buy ma la sua scadenza è > 6 mesi più lontana della mediana, escluderlo come protezione.

```typescript
export function filterAndCalculatePutPremiums(
  orders: ParsedOrder[],
  ticker: string,
  referenceExpiry?: string // mediana scadenze delle naked put in portafoglio
): OrderParseResult {
  // Step 1: filtra ordini PUT eseguiti per il ticker
  const baseFiltered = orders.filter(order => {
    const isExecuted = order.status.toLowerCase() === 'eseguito';
    const isPut = order.optionType === 'PUT';
    const matchesTicker = symbolMatchesTicker(order.symbol, ticker);
    return isExecuted && isPut && matchesTicker;
  });
  
  // Step 2: identifica simboli con almeno una vendita
  const symbolsWithSells = new Set<string>();
  for (const order of baseFiltered) {
    if (order.operation === 'sell') symbolsWithSells.add(order.symbol);
  }
  
  // Step 3: filtra buy-only PUT (protezioni pure)
  let filteredOrders = baseFiltered.filter(order => 
    symbolsWithSells.has(order.symbol)
  );
  
  // Step 4: se c'è referenceExpiry, escludi simboli con scadenza anomala
  // (comprati e venduti ma con expiry >> mediana → protezione chiusa)
  if (referenceExpiry) {
    const refDate = new Date(referenceExpiry);
    const sixMonthsMs = 6 * 30 * 24 * 60 * 60 * 1000;
    const anomalousSymbols = new Set<string>();
    
    for (const order of filteredOrders) {
      const expiry = extractExpiryFromSymbol(order.symbol);
      if (expiry) {
        const expiryDate = new Date(expiry);
        if (expiryDate.getTime() - refDate.getTime() > sixMonthsMs) {
          anomalousSymbols.add(order.symbol);
        }
      }
    }
    filteredOrders = filteredOrders.filter(o => !anomalousSymbols.has(o.symbol));
  }
  
  // Step 5: calcolo premi
  // ... (stessa logica di calcolo)
}
```

### 2. Aggiungere calcolatrice flussi alle Naked Put

**File: `src/pages/Derivatives.tsx` — `NakedPutRow`**

Stesse modifiche fatte per le altre strategie:
- Aggiungere prop `getPremiumByTickerAndSymbol`
- Stato `showCalculator`
- `optionSymbol = NP_P${strike}_${expiry}`
- `ticker` da `underlyingPrices[option.underlying]?.ticker`
- Lookup `savedPremium`
- Colonna Calculator (icona colorata/grigia)
- Colonna UNIT con `net_per_share`
- `CallPremiumCalculatorDialog` con `strategyType="other_strategy"` (terminologia "Flussi di cassa")
- Aggiornare grid template con 2 colonne extra

**Passaggio prop nel rendering (riga 632):**
```tsx
<NakedPutRow ... getPremiumByTickerAndSymbol={getPremiumByTickerAndSymbol} />
```

### 3. Toggle premi PUT nelle Covered Call

**File: `src/pages/Derivatives.tsx`**

1. **Stato:** `const [includePutPremiums, setIncludePutPremiums] = useState(false);`

2. **Switch nell'header CC** (dopo il Badge count, con `stopPropagation`):
```tsx
<div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
  <Switch checked={includePutPremiums} onCheckedChange={setIncludePutPremiums} />
  <span className="text-xs text-muted-foreground">Includi premi PUT</span>
</div>
```

3. **Memo `nakedPutPremiumsByUnderlying`:** per ogni naked put in `categories.nakedPuts`, cerca il premium salvato e somma i `net_per_share` per underlying. Le long put della sezione "Protezioni" (`categories.longPuts`) sono automaticamente escluse perché non sono nella lista `nakedPuts`.

4. **`CoveredCallRow`:** nuove prop `includePutPremiums` e `putPremiumForUnderlying`. Quando il toggle è attivo, il valore UNIT mostrato sarà `netPerShare + putPremiumForUnderlying`.

### 4. Filtro per protezioni nel calcolo PUT

La distinzione chiave rispetto al piano precedente:

- Le **Naked Put in portafoglio** (`categories.nakedPuts`) sono già classificate come PUT vendute dal sistema di override/categorizzazione. Queste sono le PUT "buone" per il toggle.
- Le **Long Put in portafoglio** (`categories.longPuts`) sono protezioni e NON devono essere incluse.
- Quando si caricano **ordini storici Excel** per una Naked Put tramite la calcolatrice, la nuova funzione `filterAndCalculatePutPremiums` filtrerà automaticamente eventuali PUT comprate-e-mai-vendute (protezioni) e PUT con scadenza anomala presenti nello stesso file Excel.

### Riepilogo modifiche

| File | Modifica |
|------|----------|
| `src/lib/orderFileParser.ts` | Nuova funzione `filterAndCalculatePutPremiums` |
| `src/pages/Derivatives.tsx` | `NakedPutRow`: Calculator + UNIT + dialog |
| `src/pages/Derivatives.tsx` | Header CC: Switch toggle |
| `src/pages/Derivatives.tsx` | `CoveredCallRow`: prop + somma PUT premiums a UNIT |
| `src/pages/Derivatives.tsx` | Memo `nakedPutPremiumsByUnderlying` + stato toggle |

Nessuna modifica al database.

### Dettaglio tecnico: come distinguere protezioni negli ordini Excel

La funzione `filterAndCalculatePutPremiums` userà questa euristica:

1. **Simboli senza vendite** → esclusi (protezione pura comprata)
2. **Simboli con vendite ma scadenza anomala**: calcola la mediana delle scadenze di tutti i simboli PUT con vendite. Se un simbolo ha scadenza > 6 mesi oltre la mediana, è probabilmente una protezione LEAP comprata e poi rivenduta → escluso
3. **Tutti gli altri** → inclusi (naked put rolling)

Questo approccio è coerente con la logica CALL esistente (che esclude buy-only CALL come LEAP) e aggiunge il controllo scadenza per il caso specifico delle PUT protezione chiuse.

