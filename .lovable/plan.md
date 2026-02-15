

## Mostrare ticker azioni + derivati nella gestione avvisi prezzo

### Problema

La funzione `extractUniqueTickers` in `AlertSettingsDialog.tsx` estrae i ticker solo dalle strategie derivati (`categories` + `underlyingPrices`). Se non ci sono strategie derivati, `availableTickers` e' vuoto e nessun badge viene mostrato, anche se il portafoglio contiene azioni con ticker validi.

### Soluzione

Aggiungere le posizioni azionarie come fonte aggiuntiva di ticker nel tab Prezzo.

**File: `src/components/derivatives/AlertSettingsDialog.tsx`**

1. Importare `usePortfolio` per accedere alle posizioni del portafoglio corrente
2. Modificare `extractUniqueTickers` (o creare logica separata) per includere anche i ticker delle posizioni di tipo `stock` (e opzionalmente `etf`) che hanno un campo `ticker` non nullo
3. Unire i ticker dai derivati e dalle azioni, eliminando i duplicati (se un ticker appare sia come azione che come sottostante derivato, mostrarlo una sola volta)
4. Ordinare alfabeticamente il risultato finale

### Dettaglio tecnico

```text
// Dentro AlertSettingsDialog, dopo le props esistenti:
const { positions } = usePortfolio();

// Nella funzione extractUniqueTickers, aggiungere parametro positions:
function extractUniqueTickers(
  categories: DerivativeCategories,
  underlyingPrices: Record<string, UnderlyingPrice>,
  positions: Position[]    // NUOVO
)

// Dopo il loop sulle categorie derivati, aggiungere:
positions
  .filter(p => p.asset_type === 'stock' && p.ticker)
  .forEach(p => {
    const ticker = p.ticker!.toUpperCase();
    if (!resolvedTickersSet.has(ticker)) {
      resolvedTickersSet.add(ticker);
      resolved.push({ underlying: p.description, ticker });
    }
  });
```

### Risultato atteso

- Se ci sono solo azioni: i badge mostrano i ticker delle azioni
- Se ci sono solo derivati: comportamento invariato (ticker dai sottostanti)
- Se ci sono entrambi: lista unificata senza duplicati, ordinata alfabeticamente

### File da modificare

| File | Modifica |
|---|---|
| `src/components/derivatives/AlertSettingsDialog.tsx` | Aggiungere `usePortfolio`, passare `positions` a `extractUniqueTickers`, includere ticker azionari nella lista |

