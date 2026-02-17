

## Fix: Colonna prezzo sottostante troppo stretta + verifica colore giallo oro

### Problema 1: Sovrapposizione triangolino rosso
La colonna "Prezzo Sottostante" nella griglia di `GroupedOtherStrategyRow` (riga 1791) e' larga solo `6rem`, insufficiente per contenere il prezzo + l'icona `StalePriceIndicator` senza debordare nella colonna P/L.

### Problema 2: Colore giallo oro
Il colore `text-yellow-500` e' gia' applicato correttamente nel codice (riga 1951). Serve solo una verifica visiva dopo il login, ma il codice e' a posto.

### Soluzione

**File: `src/pages/Derivatives.tsx`** -- riga 1791

Aumentare la larghezza della colonna 9 (Prezzo Sottostante) da `6rem` a `7rem` nel template grid:

- Da: `grid-cols-[1.25rem_minmax(10rem,1fr)_4rem_12rem_3.5rem_9rem_4rem_4.5rem_6rem_5rem]`
- A: `grid-cols-[1.25rem_minmax(10rem,1fr)_4rem_12rem_3.5rem_9rem_4rem_4.5rem_7rem_5rem]`

Questo fornisce spazio sufficiente per il prezzo + l'indicatore stale price senza sovrapposizioni con la colonna P/L.

