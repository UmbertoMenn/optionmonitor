

## Fix: Sovrapposizione indicatore stale price con P/L nelle Altre Strategie

### Problema
Dalla screenshot si vede che il contenuto della colonna "Prezzo Sottostante" (PS + triangolino rosso) deborda nella colonna "P/L" adiacente. La colonna PS a 7rem non basta quando c'e' l'indicatore stale, e la colonna P/L a 5rem non basta per valori grandi come `-20.845,00 $`.

### Soluzione

**File: `src/pages/Derivatives.tsx`** -- riga 1791

Due modifiche:

1. **Aumentare la colonna PS da `7rem` a `8rem`** per dare spazio sufficiente al prezzo + icona stale
2. **Aumentare la colonna P/L da `5rem` a `8rem`** per contenere valori monetari lunghi con il prefisso "P/L:"

Template grid aggiornato:
- Da: `...4.5rem_7rem_5rem]`
- A: `...4.5rem_8rem_8rem]`

3. **Aggiungere `overflow-hidden` alla cella PS** (riga ~1927) per evitare che il contenuto debordi in caso di valori estremi

Queste modifiche garantiscono che il triangolino rosso resti confinato nella sua colonna e il P/L sia completamente leggibile.
