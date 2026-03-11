

## Fix: Parser ordini Excel — strike decimali e robustezza colonne

### Problema principale

Il file viene parsato correttamente a livello di colonne (il `findColumnIndex` è già header-based). Il bug reale è in `extractStrikeFromSymbol`: la regex `(\d+)$` **non matcha strike con decimali** come `CEGH6P322.5`, `AVGOH6P347.5`, `LULUH6P167.5`.

```
CEGH6P322.5  → regex (\d+)$ → NO MATCH → strike = null ❌
CEGZ7P260    → regex (\d+)$ → 260 ✓
```

Questo causa il mancato riconoscimento di diversi ordini nella calcolatrice premi.

### Fix — file `src/lib/orderFileParser.ts`

**1. `extractStrikeFromSymbol`** (riga 554-557): cambiare regex per supportare decimali

```typescript
export function extractStrikeFromSymbol(symbol: string): number | null {
  // Match trailing number with optional decimal: 322.5, 167.5, 260
  const match = symbol.match(/(\d+(?:\.\d+)?)$/);
  return match ? parseFloat(match[1]) : null;
}
```

**2. Aggiungere alias colonne mancanti** per robustezza futura:
- `symbol`: aggiungere `'Titolo'` come fallback se `'Simbolo'` non presente
- `quantity`: aggiungere `'Qtà/VN'`, `'QTA/VN'` come fallback

### File da modificare
- `src/lib/orderFileParser.ts` — 2 modifiche puntuali

