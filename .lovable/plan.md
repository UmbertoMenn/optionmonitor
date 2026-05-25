Sposto le icone (i) con tooltip nel posto giusto: `src/components/risk/EquityExposureView.tsx`, accanto al valore EUR di ogni riga di dettaglio di ogni categoria.

## File da modificare

### `src/components/risk/EquityExposureView.tsx` (unico file)

Aggiungere un piccolo componente locale `CalcInfo` (icona `Info` di lucide-react come trigger di un Tooltip già importato in questo file) e inserirlo accanto a `formatEUR(...)` in ogni riga delle 7 sezioni di dettaglio dell'Equity Exposure:

1. **Dettaglio ETF Azionari** (`sortedETFDetails.map`, riga "Rischio: {formatEUR(stock.riskEUR)}") — tooltip: `qty × prezzo × FX = valore lordo` + eventuale `− contratti × strike × 100 × FX` per protezione, con risultato finale `riskEUR`.
2. **Dettaglio Stocks** (`sortedPureStockDetails.map`) — stesso schema; per `isSynthetic` mostrare la stringa `composition` se disponibile e nota "rischio CC/DR-CC sintetica".
3. **Dettaglio CC e DR-CC sintetiche** (`sortedSyntheticCcDrccDetails.map`) — tooltip: variante (CC/DR-CC, lato CALL/PUT) + `composition` + valuta originale `riskOriginal × 1/FX → riskEUR`.
4. **Dettaglio Commodities** (`sortedCommodityDetails.map`) — tooltip: `quantità × prezzo × FX = riskEUR`.
5. **Dettaglio Naked PUT** (`sortedNakedPutDetails.map`) — tooltip: `contratti × strike × 100 × FX = riskEUR` (rischio di assegnazione).
6. **Dettaglio Leap Call** (`sortedLeapCallDetails.map`) — tooltip: `contratti × marketPrice × 100 × FX = riskEUR` (valore di mercato).
7. **Dettaglio Strategie** (`sortedStrategyDetails.map`) — tooltip: `strategyName` + `strat.calculation` (campo già esistente) + nota su `hasUnlimitedRisk` se presente; valore = `maxLossEUR`.

Inoltre: aggiungere la (i) anche nelle **righe-intestazione** di ogni accordion delle sezioni di dettaglio (accanto a "Rischio totale: …"), con la spiegazione metodologica della categoria.

Nessun cambio a backend, RLS, calcoli o altre view. È puramente UI: icona `Info` + Tooltip.

## Nota
Le icone aggiunte in precedenza in `SectorAllocationView.tsx` e `CurrencyExposureView.tsx` restano (non disturbano e sono coerenti), ma il fix richiesto è qui.