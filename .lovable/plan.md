
# Piano: Correzione Ticker Non Risolti nel Dialog Avvisi

## Problema Identificato

Dallo screenshot l'utente vede che MSFT e NFLX sono risolti correttamente, ma AMAZON.COM.INC, Abercrombie & fitch co, e Adobe Inc sono mostrati come "ticker non risolti".

### Causa Radice

La logica attuale in `Derivatives.tsx` (linee 107-137) **esclude selettivamente** alcuni underlying dal fetch dei prezzi:

```typescript
const allUnderlyingNames = useMemo(() => {
  const names = new Set<string>();
  
  // Iron Condors - OK
  categories.ironCondors.forEach(ic => names.add(ic.underlying));
  
  // Double Diagonals - OK
  categories.doubleDiagonals.forEach(dd => names.add(dd.underlying));
  
  // Naked Puts - SOLO se non hanno underlying in portafoglio!
  categories.nakedPuts.forEach(np => {
    if (!np.underlying?.current_price && np.option.underlying) {
      names.add(np.option.underlying);
    }
  });
  
  // Leap Calls - SOLO se non hanno underlying in portafoglio!
  categories.leapCalls.forEach(lc => {
    if (!lc.underlying?.current_price && lc.option.underlying) {
      names.add(lc.option.underlying);
    }
  });
  
  // Covered Calls - NON INCLUSE!
  // groupedOtherStrategies - OK
}, [categories]);
```

**Problema**: Le **Covered Calls non sono incluse** e le Naked Puts/Leap Calls con sottostante in portafoglio sono escluse. Quindi `underlyingPrices` contiene solo MSFT e NFLX (probabilmente Iron Condor/Double Diagonal), mentre AMAZON, Adobe, Abercrombie (Covered Calls o Naked Puts con sottostante) non vengono mai fetchati.

---

## Soluzione

Modificare la raccolta degli underlying in `Derivatives.tsx` per includere **TUTTI** gli underlying, indipendentemente dal fatto che abbiano già un prezzo in portafoglio. Il prezzo può essere già disponibile, ma ci serve comunque il **ticker risolto** dalla edge function.

---

## Modifiche Tecniche

### File: `src/pages/Derivatives.tsx`

Modifica alla logica `allUnderlyingNames`:

```typescript
// Extract all unique underlying names for price fetching
const allUnderlyingNames = useMemo(() => {
  const names = new Set<string>();
  
  // Iron Condors
  categories.ironCondors.forEach(ic => names.add(ic.underlying));
  
  // Double Diagonals
  categories.doubleDiagonals.forEach(dd => names.add(dd.underlying));
  
  // Naked Puts - TUTTI, non solo quelli senza prezzo
  categories.nakedPuts.forEach(np => {
    if (np.option.underlying) {
      names.add(np.option.underlying);
    }
  });
  
  // Leap Calls - TUTTI, non solo quelli senza prezzo
  categories.leapCalls.forEach(lc => {
    if (lc.option.underlying) {
      names.add(lc.option.underlying);
    }
  });
  
  // Covered Calls - AGGIUNGERE!
  categories.coveredCalls.forEach(cc => {
    if (cc.option.underlying) {
      names.add(cc.option.underlying);
    }
  });
  
  // Long Puts (protezioni)
  categories.longPuts.forEach(lp => {
    if (lp.option.underlying) {
      names.add(lp.option.underlying);
    }
  });
  
  // Grouped Other Strategies
  categories.groupedOtherStrategies.forEach(group => {
    names.add(group.underlying);
  });
  
  return Array.from(names);
}, [categories]);
```

---

## Risultato Atteso

Dopo questa modifica:

1. La edge function `fetch-underlying-prices` riceverà TUTTI gli underlying (inclusi AMAZON.COM.INC, Adobe Inc, Abercrombie & fitch co)
2. La edge function risolverà i ticker (AMZN, ADBE, ANF)
3. L'oggetto `underlyingPrices` conterrà tutti i ticker risolti
4. Il dialog "Gestione Avvisi" mostrerà tutti i ticker disponibili senza "non risolti"

---

## Sequenza Implementazione

1. **Modifica `Derivatives.tsx`**: Aggiungere Covered Calls e rimuovere condizioni restrittive per Naked Puts/Leap Calls
2. **Test**: Verificare che la edge function riceva tutti gli underlying e restituisca i ticker

---

## File da Modificare

| File | Modifica |
|------|----------|
| `src/pages/Derivatives.tsx` | Espandere `allUnderlyingNames` per includere tutti gli underlying da tutte le categorie |
