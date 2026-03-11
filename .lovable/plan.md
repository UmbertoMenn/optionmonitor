

## Fix: Stock trades (NN) inclusi come opzioni + perdita ordini al salvataggio

### Bug 1: Ordini non-opzione inclusi nel calcolo

Il parser legge la colonna `Call/Put`. Per le righe con `NN` (azioni, non opzioni), `normalizeOptionType` ritorna `null`. Ma questi ordini non vengono mai filtrati e finiscono nelle operazioni mostrate nella calcolatrice.

**Fix in `src/lib/orderFileParser.ts`** — nel loop di parsing (riga ~443), aggiungere un filtro: se la colonna `Call/Put` esiste e il valore è "NN" (o altro valore non-opzione), saltare la riga.

```typescript
// After parsing optionType (line ~434)
// Skip non-option rows (e.g. stock trades where Call/Put = "NN")
if (colIndices.callPut !== -1 && optionType === null) {
  const callPutRaw = String(row[colIndices.callPut] || '').trim().toUpperCase();
  if (callPutRaw === 'NN' || callPutRaw === '') continue;
}
```

### Bug 2: Ordini persi al salvataggio dopo rimozione

Quando si rimuove un ordine e si salva, `handleSave` salva `filteredOrders` che è `callOrders` quando `includePutPremiums` è false. Ma `handleRemoveOrder` splitta con `o.optionType !== 'PUT'` (calls) e `o.optionType === 'PUT'` (puts), quindi i PUT vengono persi dal salvataggio.

Questo bug esiste già a prescindere dal problema NN, ma il problema NN lo rende più visibile. 

**Fix in `src/components/derivatives/CallPremiumCalculatorDialog.tsx`** — `handleSave` deve salvare **tutti** gli ordini (call + put), non solo `filteredOrders`:

```typescript
// Line ~288: save ALL orders, not just filtered
orders_json: [...callOrders, ...putOrders],
```

### File da modificare
- `src/lib/orderFileParser.ts` — filtrare righe con Call/Put = "NN"
- `src/components/derivatives/CallPremiumCalculatorDialog.tsx` — salvare tutti gli ordini nel handleSave

