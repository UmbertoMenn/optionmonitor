## Obiettivo
Nella card **Beta @ scenario / Delta portafoglio** (Risk Simulator) aggiungere, sotto il valore principale, un piccolo numero che mostra lo stesso beta/delta a scenario ma calcolato dividendo per il **netting totale** (patrimonio dashboard) invece che per l'**Esposizione Potenziale in Equity**. Servirà poi per ponderare il benchmark nell'equity line della dashboard.

## Cosa cambia

File: `src/pages/RiskSimulator.tsx`, card alle righe ~1215-1305 (Panel "Beta @ scenario / Delta portafoglio").

Dentro l'IIFE già presente (riga 1276), oltre a `headline`, `refDn`, `refUp`, calcolare la versione "netting totale":

```ts
const denomTot = data.nettingTotalRaw;  // patrimonio dashboard
const scale = denomTot && ptfBase ? ptfBase / denomTot : 0;
const headlineTot = headline * scale;
```

Motivo della formula: `betaScen = PnL / ptfBase / shock`. Cambiando solo il denominatore: `PnL / nettingTotal / shock = betaScen · ptfBase / nettingTotal`. Identica logica per `deltaScen`. Nessun rerun degli scenari.

Aggiungere, dopo la riga "rif. ↓ · ↑ (∓10%)", una riga in piccolo:

```
β/δ vs patrimonio: <headlineTot, 2 dec>
```

Stile: stessa famiglia mono, `fontSize: 10.5`, `color: C.mut`. Etichetta dinamica in base a `shockMode` ("β vs patrimonio totale" oppure "δ vs patrimonio totale").

## Tooltip
Estendere l'Info esistente con una breve nota finale:
> Il valore principale usa come denominatore l'**Esposizione Potenziale in Equity**. Sotto, in piccolo, lo stesso beta/delta riferito al **patrimonio totale** (netting completo della dashboard): è la base corretta per ponderare il rendimento del benchmark sull'equity line della dashboard.

## Fuori scope
L'uso effettivo del numero nell'equity line del benchmark in dashboard non è incluso (lo si farà quando confermerai dove e come visualizzarlo).
