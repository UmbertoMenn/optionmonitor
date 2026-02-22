

## Fix: Approccio barriera deve cercare su multiple scadenze future

### Problema attuale

In `executeApproachRule` (riga 379), il codice prova SOLO la scadenza immediatamente successiva a quella della leg:

```text
const nextExpiry = findNextExpiry(leg.expiryDate, allExpiries);
// prova solo questa scadenza
// se roll_up_positive fallisce il check credito netto -> return null
// la leg resta attiva ma bloccata: alla barra successiva stessa situazione
```

Se con la scadenza successiva il credito netto non e sufficiente (call deep ITM costa troppo da ricomprare), il roll non avviene MAI. La leg resta bloccata fino alla scadenza naturale, creando il gap operativo.

### Soluzione

Trasformare la ricerca in un loop su tutte le scadenze future a partire da quella successiva alla leg corrente, provando per ciascuna se le condizioni sono soddisfatte. La prima scadenza che produce un credito netto valido viene usata per il roll.

Questo e lo stesso approccio gia usato nella `executeProfitRule` (righe 554-584) che itera su `allExpiries`.

### Modifica in `src/lib/backtestEngine.ts`

Funzione `executeApproachRule`, righe 378-398. Sostituire la logica a singola scadenza con un loop:

```text
// PRIMA (singola scadenza):
const nextExpiry = findNextExpiry(leg.expiryDate, allExpiries);
if (!nextExpiry) return null;
// ... prova solo nextExpiry, se fallisce return null

// DOPO (loop su scadenze):
const futureExpiries = allExpiries.filter(e => e > leg.expiryDate.slice(0, 10));
if (futureExpiries.length === 0) return null;

for (const candidateExpiry of futureExpiries) {
  const newT = yearsBetween(date, candidateExpiry);
  if (newT <= 0) continue;

  const newStrike = roundStrike(S * (1 + approachRule.rollUpMinDistancePct / 100), strikeStep);
  const newIV = ivSurface.getIV(newStrike, candidateExpiry, 'call');
  const newPrice = bsPrice(S, newStrike, newT, riskFreeRate, newIV, 'call');

  if (approachRule.action === 'roll_up_positive') {
    const netPremium = newPrice - currentPrice;
    const meetsUsd = netPremium >= approachRule.minPremiumUsd;
    const meetsPct = netPremium >= S * (approachRule.minPremiumPct / 100);
    if (!meetsUsd && !meetsPct) continue;  // prova scadenza successiva
  }

  // Trovata scadenza valida: esegui il roll
  leg.active = false;
  const closeCost = -currentPrice * leg.quantity * 100;
  const openCost = newPrice * leg.quantity * 100;
  const newLeg = { ... strike: newStrike, expiryDate: candidateExpiry, ... };
  activeLegs.push(newLeg);
  return { adjustment con candidateExpiry };
}

return null;  // nessuna scadenza soddisfa le condizioni
```

### Comportamento dopo il fix

Esempio con prezzo a 150, strike vecchio 135, call deep ITM ($15):

1. Prova scadenza +1 mese: nuova call OTM strike 155 vale $2. Credito netto = $2 - $15 = -$13. Fallisce.
2. Prova scadenza +2 mesi: nuova call vale $4. Credito netto = -$11. Fallisce.
3. Prova scadenza +3 mesi: nuova call vale $7. Credito netto = -$8. Fallisce.
4. ...continua fino a trovare una scadenza con valore temporale sufficiente.
5. Se nessuna scadenza funziona, la leg resta attiva e scadra naturalmente.

Per `roll_up` (senza vincolo di credito positivo), la prima scadenza disponibile viene sempre usata (comportamento invariato).

### Riepilogo

| File | Righe | Modifica |
|------|-------|----------|
| `src/lib/backtestEngine.ts` | 378-398 | Loop su `allExpiries.filter(e > leg.expiryDate)` invece di singola `findNextExpiry` |

