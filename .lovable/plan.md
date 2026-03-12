

## Due modifiche: chiusura PUT assegnata nell'URL + ordine cronologico nel riepilogo

### 1. URL OptionStrat: chiudere la PUT assegnata a prezzo 0

**Problema**: Quando c'è un'assegnazione, l'URL include solo la riga stock (`TICKERx{qty}@{strike}@{sellPrice}`) ma non chiude l'opzione PUT assegnata. Su OptionStrat la PUT risulta ancora aperta.

**Soluzione**: Per ogni assegnazione, aggiungere anche una leg di chiusura della PUT a prezzo 0, nel formato `-.TICKER{YYMMDD}P{strike}@{sellPremium}@0`.

Per farlo servono due sotto-modifiche:

**a) `src/lib/orderFileParser.ts` — `buildAssignmentOrder` + `ParsedOrder`**
- Aggiungere campo opzionale `assignmentPutSymbol?: string` all'interfaccia `ParsedOrder`
- In `buildAssignmentOrder`, accettare il simbolo PUT come parametro aggiuntivo e salvarlo nel campo `assignmentPutSymbol`

**b) `src/components/derivatives/CallPremiumCalculatorDialog.tsx`**
- Passare `openPuts[0].symbol` (o il simbolo scelto dall'utente nel dialog) a `buildAssignmentOrder`

**c) `src/lib/optionStratUrl.ts` — `buildOptionStratUrlFromOrders`**
- Per ogni assignment order, oltre alla riga stock, generare anche la leg di chiusura PUT:
  - Estrarre tipo/strike/expiry dal `assignmentPutSymbol`
  - Cercare nell'array degli ordini la vendita originale della PUT (stesso simbolo, operation=sell) per ricavare il prezzo di apertura
  - Generare: `-.TICKER{YYMMDD}P{strike}@{openPrice}@0`

### 2. Riepilogo operazioni: ordine cronologico misto CALL+PUT

**Problema**: `filteredOrders` è costruito come `[...callOrders, ...putOrders]` — prima tutte le CALL, poi tutte le PUT. L'utente vuole ordine cronologico come nel file Excel.

**Soluzione in `src/components/derivatives/CallPremiumCalculatorDialog.tsx`**:
- Cambiare la derivazione di `filteredOrders` (riga 123):
  ```typescript
  const filteredOrders = useMemo(() => {
    const combined = includePutPremiums ? [...callOrders, ...putOrders] : callOrders;
    // Sort by validityDate (file order preserved for same date via stable sort)
    return combined.sort((a, b) => {
      const da = toIsoDateFromIT(a.validityDate) || '';
      const db = toIsoDateFromIT(b.validityDate) || '';
      return db.localeCompare(da); // descending (most recent first, like file)
    });
  }, [callOrders, putOrders, includePutPremiums]);
  ```
- Nota: l'ordine file originale è dal più recente al più vecchio (descending). Per operazioni con stessa data, `sort` stabile preserva l'ordine di inserimento (= ordine file Excel).

### File da modificare
1. `src/lib/orderFileParser.ts` — aggiungere `assignmentPutSymbol` a `ParsedOrder` e parametro a `buildAssignmentOrder`
2. `src/components/derivatives/CallPremiumCalculatorDialog.tsx` — passare simbolo PUT, ordinare `filteredOrders` cronologicamente
3. `src/lib/optionStratUrl.ts` — generare leg chiusura PUT a @0 per ogni assegnazione

