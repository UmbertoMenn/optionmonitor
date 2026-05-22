# Tooltip (i) di spiegazione calcolo nel dettaglio del Risk Analyzer

## Obiettivo
Nel dialog "Breakdown" del Risk Analyzer, aggiungere accanto a ogni riga (Stock, PUT, LEAP, Strategie, Sintetiche CC/DR-CC) un'icona informativa (i) che, al hover, mostra la formula esatta con cui è stato calcolato il rischio di quella posizione, usando i numeri reali (quantità, strike, contratti, prezzo, FX).

## Cosa mostrare per tipo di riga

- **Stock diretto**: `quantità × prezzo × FX = valore EUR`. Se protetto: aggiungere riga `− contratti × strike × 100 × FX = valore netto`.
- **Sintetica CC/DR-CC**: mostrare la composizione già calcolata (es. `Long CALL 60 ITM + Short CALL 150`) e la formula applicata in base al tipo:
  - `cc_call`: `PMC long × qty × 100 / FX` (spot > short strike) oppure `mkt long × qty × 100 / FX` (spot ≤ short strike)
  - `cc_put`: `strike PUT × |qty| × 100 / FX`
  - `drcc_call`: stessa formula di `cc_call`
  - `drcc_put`: `(strike PUT venduta − strike PUT protezione) × contratti × 100 / FX`
- **Naked PUT**: `contratti × strike × 100 × FX = rischio EUR`.
- **LEAP Call**: `contratti × prezzo mercato × 100 × FX = valore mercato EUR` (rischio = premio pagato attuale).
- **Strategia**: `Max Loss universale calcolato sul payoff a scadenza` + nota se `hasUnlimitedRisk` (lato call illimitato non incluso).

## File da modificare

### `src/lib/riskCalculator.ts`
- Aggiungere campo `calcExplanation: string` (opzionale) alle interfacce dei detail già emessi: stock, nakedPut, leapCall, strategy, syntheticCcDrcc.
- Popolarlo nelle funzioni di costruzione esistenti, usando i valori già disponibili. Per le sintetiche riutilizzare `composition` + formula scelta in `buildCallBasedEntry` / branch PUT.

### `src/lib/sectorExposure.ts`
- Propagare `calcExplanation` nei push verso `stockDetails`, `nakedPutDetails`, `leapCallDetails`, `strategyDetails` di `ConsolidatedHoldingWithDetails`.
- Aggiornare le interfacce di questi array per includere il campo opzionale.

### `src/components/risk/HoldingBreakdownDialog.tsx`
- Importare `Info` da lucide-react e `Tooltip, TooltipTrigger, TooltipContent` (già usati nel file).
- A fianco di ogni valore in EUR di ciascuna riga (Stock, PUT, LEAP, Strategie), renderizzare `<Info className="w-3.5 h-3.5 text-muted-foreground" />` come trigger di tooltip che mostra `calcExplanation` con font monospace per la formula.
- Fallback: se `calcExplanation` non è disponibile, non mostrare l'icona.

## Note

- Nessuna modifica a database, RLS, edge functions o logica di calcolo del rischio: si aggiunge solo una stringa descrittiva derivata dai valori già calcolati.
- I valori mostrati nella formula useranno i formatter esistenti (`formatNumber`, `formatEUR`) per coerenza visiva.
- Il tooltip è puramente esplicativo per l'utente; non altera totali né esposizioni.
