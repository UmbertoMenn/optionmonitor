## Obiettivo

Considerare anche le coperture **parziali per quantità** come "gamba mancante", non solo l'assenza totale di una gamba.

- Esempio CC: 200 azioni GOOG + 1 short call → 1 contratto mancante → già finisce in "Covered Call da rivendere" (OK), aggiungiamo coerenza per le multi-gamba.
- Esempio DD: 4 long call + 2 short call → strategia classificata regolarmente, ma segnalata come incompleta con "Short Call ×2".

## Modifiche

### 1. `src/lib/derivativeStrategies.ts`

- Aggiungere `missingQuantity?: number` (e/o cambiare le label in `'Short Call ×2'`) all'interfaccia `IncompleteStrategyPosition` per veicolare la quantità mancante.
- Estendere la classificazione per controllare lo **sbilancio di contratti** sulle strategie a coppie. Per ogni `case`:
  - `iron_condor`: confrontare `|Σsc|` vs `|Σbc|` e `|Σsp|` vs `|Σbp|`. La strategia resta classificata sul minimo coperto; il delta finisce in `incompleteStrategies` con `missingLegs: ['Short Call ×N']` o `'Long Call ×N'` ecc.
  - `double_diagonal`: stessa logica delle due coppie call/put (è esattamente l'esempio dell'utente).
  - `call_spread` / `diagonal_call_spread`: confronto `|Σsc|` vs `|Σbc|`.
  - `put_spread` / `diagonal_put_spread`: confronto `|Σsp|` vs `|Σbp|`.
- Le strategie totalmente prive di una gamba continuano a essere segnalate come oggi (la differenza è solo che ora la label porta anche il numero quando rilevante).
- **Covered Call / DR-CC non sintetiche**: niente nuova segnalazione qui — la copertura parziale è già rilevata in `computeAvailableCalls` e mostrata in "Covered Call da rivendere", che è esattamente quello che l'utente chiede per il caso GOOG.
- **Naked Put / LEAP Call / Protection**: nessun controllo di coppia, non cambia nulla.

### 2. `src/lib/monitoringEngine.ts`

- `computeIncompleteMultiLeg` (riga ~636): propagare `missingQuantity` se valorizzato e usarlo per costruire la label finale (`"Short Call (×2)"`).
- Il rendering attuale nel briefing (`monitoring.incompleteMultiLegStrategies.map(s => …(manca: ${s.missingLegs.join(', ')})`) funziona già perché la quantità entra nella stringa stessa della label.

### 3. UI Dashboard / Briefing

Nessuna modifica componenti — `DerivativesSummaryCard` e il briefing leggono già `missingLegs: string[]`, le nuove label `"Short Call ×2"` appariranno automaticamente.

## Comportamento finale

- DD con 4 LC / 2 SC → continua ad apparire come Double Diagonal in pagina, e in "Strategie incomplete" compare: `TICKER Double Diagonal (manca: Short Call ×2)`.
- IC con 3 short put / 1 long put → `(manca: Long Put ×2)`.
- Call spread con 2 LC / 1 SC → `(manca: Short Call ×1)`.
- GOOG 200 azioni + 1 SC → resta in "Covered Call da rivendere" come oggi (1 call disponibile), nessuna duplicazione in "Strategie incomplete".
