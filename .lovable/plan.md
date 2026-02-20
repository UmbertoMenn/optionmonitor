

## Correzione 3 Bug nel Backtest Engine

### Bug 1: Prezzo di riacquisto errato nei Movimenti

Quando una call viene chiusa (riacquistata), la tabella Movimenti mostra il prezzo originale di vendita (`entryPrice`) invece del prezzo di mercato corrente al momento della chiusura. Il problema e che `legsRemoved` viene salvato con `{ ...leg }` che copia l'`entryPrice` originale.

**Fix**: Aggiungere un campo opzionale `closePrice` a `BacktestLeg`. Nelle funzioni di aggiustamento (`executeApproachRule`, `executeProfitRule`, `handleExpiryDoNothing`), impostare `closePrice = currentPrice` sulla copia della leg rimossa. In `BacktestResults`, usare `closePrice ?? entryPrice` per le righe di chiusura.

### Bug 2: Strike arrotondati allo strikeStep

Lo `StrategyBuilder` calcola lo strike iniziale con `Math.round(entryPrice * (1 + pct/100))` senza usare lo `strikeStep`. Gli strike devono sempre essere multipli di `strikeStep`.

**Fix**: Passare `strikeStep` (da `ccRules.strikeStep`) come prop a `StrategyBuilder`. Usare `roundStrike(target, strikeStep)` per calcolare `callStrike`.

### Bug 3: Nessuna operazione dopo l'ultimo roll

Dopo la vendita della nuova call, il motore non genera piu operazioni. Causa principale: in `executeApproachRule`, la riga `leg.active = false` viene eseguita PRIMA di verificare se esiste un `nextExpiry`. Se `findNextExpiry` restituisce `undefined`, la funzione ritorna `null` ma la leg e gia stata disattivata -- la posizione sparisce silenziosamente.

Inoltre, il calcolo del prezzo corrente per le leg rimosse a scadenza non usa il prezzo BS attuale ma solo il valore intrinseco, impedendo il corretto tracciamento.

**Fix**:
- In `executeApproachRule`: spostare `leg.active = false` DOPO il controllo `nextExpiry`, cosi se non c'e scadenza successiva la leg resta attiva.
- In `handleExpiryDoNothing` e `sellNewCallAfterExpiry`: stessa protezione, revert `leg.active` se non si riesce a completare l'operazione.
- Nelle funzioni di scadenza, memorizzare il prezzo corrente dell'opzione (intrinseco a scadenza) come `closePrice` sulle `legsRemoved`.

### Dettaglio tecnico

| File | Modifica |
|------|----------|
| `src/lib/backtestEngine.ts` | Aggiungere `closePrice?` a `BacktestLeg`; fix ordine `leg.active = false` in tutte le funzioni di aggiustamento; impostare `closePrice` sulle leg rimosse |
| `src/components/simulator/BacktestResults.tsx` | Usare `closePrice ?? entryPrice` per il prezzo delle righe di chiusura nella tabella Movimenti |
| `src/components/simulator/StrategyBuilder.tsx` | Aggiungere prop `strikeStep`, usare `roundStrike` per calcolare lo strike della call |
| `src/pages/Simulator.tsx` | Passare `ccRules.strikeStep` a `StrategyBuilder` |

### Modifiche dettagliate

**backtestEngine.ts - BacktestLeg**:
```text
export interface BacktestLeg {
  ...
  closePrice?: number;  // prezzo di mercato al momento della chiusura
}
```

**backtestEngine.ts - executeApproachRule** (fix ordine):
```text
// PRIMA: leg.active = false era qui
const nextExpiry = findNextExpiry(leg.expiryDate, allExpiries);
if (!nextExpiry) return null;  // leg resta attiva
// ORA: leg.active = false qui, DOPO il check
leg.active = false;
```

**backtestEngine.ts - legsRemoved con closePrice**:
Ogni adjustment imposta `closePrice` sulla copia della leg rimossa con il prezzo BS corrente.

**BacktestResults.tsx - buildMovements**:
```text
// Per legsRemoved, usare closePrice se disponibile
price: leg.closePrice ?? leg.entryPrice,
```

**StrategyBuilder.tsx**:
```text
// Nuova prop
strikeStep: number;
// Calcolo strike
const callStrike = roundStrike(entryPrice * (1 + callDistancePct / 100), strikeStep);
```

