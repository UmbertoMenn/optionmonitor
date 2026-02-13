

## Allineare la card "Posizioni da monitorare" ai prezzi live

### Problema

La card "Posizioni da monitorare" in `DerivativesSummaryCard.tsx` usa sorgenti prezzo diverse dalle righe di dettaglio in `Derivatives.tsx`:

| Sezione nella card | Sorgente prezzo attuale | Dettaglio usa |
|---|---|---|
| Covered Call ITM | `cc.underlying.current_price` (Excel) | `underlyingPrices` (live) |
| Naked Put ITM | `np.underlying?.current_price` (Excel) | `underlyingPrices` (live) |
| Iron Condor OOR | `underlyingPrices` (live) | `underlyingPrices` (live) |
| Double Diagonal OOR | `underlyingPrices` (live) | `underlyingPrices` (live) |
| Altre Strategie OOR/OOB | `underlyingPrices` (live) | `underlyingPrices` (live) |

Le prime due sezioni usano lo snapshot Excel, mentre le righe di dettaglio (dopo l'ultimo fix) usano i prezzi live. Questo causa discrepanze: una Covered Call puo risultare ITM nella card ma OTM nel dettaglio (o viceversa).

### Fix

**File: `src/components/derivatives/DerivativesSummaryCard.tsx`**

Due modifiche puntuali:

**1. Covered Call ITM (linea 225)**
- Da: `const underlyingPrice = cc.underlying.current_price || 0;`
- A: `const underlyingPrice = (cc.option.underlying ? underlyingPrices[cc.option.underlying]?.price : 0) || 0;`

**2. Naked Put ITM (linea 313)**
- Da: `const underlyingPrice = np.underlying?.current_price || 0;`
- A: `const underlyingPrice = (np.option.underlying ? underlyingPrices[np.option.underlying]?.price : 0) || 0;`

### Risultato

Tutte le sezioni della card useranno `underlyingPrices` (prezzi live Yahoo, aggiornati ogni 5 min), allineandosi perfettamente ai badge nelle righe di dettaglio.

### Nessun impatto su

- Dashboard e Risk Analyzer (continuano a usare snapshot Excel)
- Edge Functions (usano `underlying_prices` dal DB)
- Logica di classificazione delle strategie

