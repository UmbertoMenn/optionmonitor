## Obiettivo

1. Allineare le formule di rischio per CC e DR-CC (sia reali che sintetiche) alle regole indicate.
2. Estrarre le posizioni sintetiche dal blocco "Rischio Stocks" e mostrarle in una nuova sezione dedicata "Rischio CC e DR-CC sintetiche" con composizione visibile.
3. Evitare regressioni nei totali, donut chart, Sector/Currency view e nei toggle.

## Formule target

### CC reale (titolo + short CALL)
- spot ≥ strike call → rischio sulle shares coperte = strike × shares
- spot < strike call → rischio sulle shares coperte = spot × shares
(comportamento già corretto oggi: il cap CC ITM applica `strike × shares`, il caso OTM ricade su `spot × shares` perché non scatta il cap)

### DR-CC reale (titolo + short CALL + long PUT protezione)
- spot ≥ strike call → rischio shares = (strike call − strike protezione) × shares  *(già ok)*
- spot < strike call → rischio shares = max(0, spot − strike protezione) × shares  *(conferma utente)*

Oggi questo secondo caso passa per il ramo "protected shares" con `protectedRisk = protectedShares × max(0, price − strike protezione)`. È coerente, ma solo se la PUT viene riconosciuta come protezione e abbinata alle 100 shares della DR-CC. Aggiungo guard esplicito: per ogni DR-CC OTM forzo il calcolo `max(0, spot − strikeProt) × shares` sulle shares coperte invece di affidarmi al solo conteggio long-PUT, così la formula tiene anche se la PUT è classificata altrove.

### CC sintetica
- Variante `syntheticPut` (short PUT deep ITM + short CALL): `strike_PUT × |qty_PUT| × 100` *(già ok)*
- Variante `syntheticCall` (long CALL ITM + short CALL):
  - spot ≥ strike call venduta → `(strike_callVenduta − strike_callComprata) × qty × 100`
  - spot < strike call venduta → `price_callComprata × qty × 100` *(oggi sempre questo; va condizionato)*

### DR-CC sintetica
- Variante `syntheticPut` (short PUT ITM + short CALL + long PUT protezione): SEMPRE `(strike_PUTVenduta − strike_PUTProtezione) × contratti × 100`
- Variante `syntheticCall` (long CALL ITM + short CALL classificata come DR-CC): `price_callComprata × qty × 100` (invariato — è il caso "rischio limitato al market value della CALL comprata")

### Sorgente spot per le sintetiche
Per le varianti `syntheticCall` serve lo spot del sottostante. Risoluzione (in ordine):
1. Cerca nelle `positions` un titolo (asset_type stock/ETF) con `matchesUnderlying` rispetto all'opzione sintetica → usa `snapshot_price ?? current_price`.
2. Fallback: cache live `useUnderlyingPrices` per ticker risolto.
3. Se entrambi assenti → fallback al comportamento attuale (`price_callComprata × qty × 100`), così niente NaN/0 spurio.

## Modifiche tecniche

### `src/lib/riskCalculator.ts`
- `calculateSyntheticCcDrccRisk` accetta nuovo parametro `spotResolver: (underlyingName: string, tickerKey: string) => number | null` e applica la logica condizionale per `syntheticCall` di CC.
- Per DR-CC `syntheticCall`: nessun cambio formula.
- Per CC reale e DR-CC reale: nessun cambio nel ramo ITM. Per DR-CC reale OTM aggiungo controllo dedicato che, sulle `drccShares`, sostituisce il contributo "shares non protette × prezzo" con `max(0, prezzo − strikeProtezione) × shares` se le shares non risultano già coperte dal long-PUT (evita doppio conteggio).
- Nuovo campo opzionale in `StockRiskDetail` per le sintetiche: `composition: string` (es. "Long CALL 150 + Short CALL 170", "Short PUT 200 ITM + Short CALL 180 + Protezione PUT 190") usato dalla UI.
- Nuovo totale dedicato in `RiskAnalysis`: `totalSyntheticCcDrccRisk: number` e nuovo array `syntheticCcDrccDetails: StockRiskDetail[]`. Le sintetiche **NON** vengono più incluse in `stockDetails`/`totalPureStockRisk`/`totalStockRisk` per evitare confusione e bug; restano però contate nel `grandTotal` tramite il nuovo totale.
- `analyzePortfolioRisk` orchestra il resolver passando `positions` e ritorna i nuovi campi.

### `src/hooks/useRiskAnalysis.ts`
- Estende `empty` con `totalSyntheticCcDrccRisk: 0` e `syntheticCcDrccDetails: []`.
- Nel merge dell'aggregato somma il nuovo totale e concatena il nuovo array.
- Per il `spotResolver` passa le posizioni snapshot al `analyzePortfolioRisk`. La cache live `useUnderlyingPrices` viene passata come opzionale (lookup sincrono dal dato già in cache; se non ancora caricata, si usa solo lo snapshot).

### `src/components/risk/EquityExposureView.tsx`
- Nuova card "Rischio CC e DR-CC sintetiche" tra "Rischio Stocks" e "Rischio Naked PUT" (sopra Strategie). Mostra:
  - totale EUR
  - lista ordinata per `riskEUR` desc con: underlying, badge tipo (CC/DR-CC, PUT/CALL), `composition`, importo in valuta originale e EUR
- Nuovo toggle "CC/DR-CC sintetiche" (default ON) che include/esclude il valore dal `dynamicGrandTotal` e dal donut chart (nuova fetta colore `bg-fuchsia-500`).
- Rimuovo dal blocco "Rischio Stocks" il fallback `isSynthetic` (sort + render) perché ora le sintetiche non vivono lì.

### `src/lib/sectorExposure.ts`
- `calculateSectorAllocation` e `calculateConsolidatedTopHoldings`: oggi cercano `isSynthetic` dentro `stockDetails`. Aggiungo parametro opzionale `syntheticCcDrccDetails` e li tratto come oggi (sector via mapping/getStockSector, currency via `riskEUR × exchangeRate`). Mantengono comportamento attuale, solo cambia la sorgente dati.

### `src/lib/currencyExposure.ts`
- `useCurrencyExposure`: oggi itera su `stockDetails` filtrando per `isSynthetic`. Cambio a iterare anche su `syntheticCcDrccDetails` (sempre incluse, indipendenti dal toggle "Protezioni" che resta riferito alle sole azioni reali).

### `src/components/risk/HoldingBreakdownDialog.tsx`
- Continua a gestire `isSynthetic` per gli holdings consolidati (Sector/Currency views). Nessun cambio strutturale, solo verifica che il dato `composition` venga mostrato se presente.

### `useRiskAnalysis` tipi
- Aggiorno l'interfaccia `RiskAnalysis` per i due nuovi campi e tutti i consumatori (riferimenti grep: `EquityExposureView`, `CurrencyExposureView`, `SectorAllocationView`, `useCurrencyExposure`, `sectorExposure.ts`).

## Anti-bug & verifica

1. **Doppio conteggio**: la sintetica non sarà più in `stockDetails`, quindi `totalPureStockRisk` non la conta. Il `grandTotal` la somma una sola volta tramite `totalSyntheticCcDrccRisk`.
2. **DR-CC reale OTM**: aggiungo test mentale su un caso (spot 100, strike call 110, strike put protezione 95, 100 shares):
   - oggi: protectedRisk = 100 × max(0, 100−95) = 500. `drccShares=0` (non ITM), shares "unprotected" residue = 0 se la PUT copre tutto. Risultato 500 ✓
   - se la PUT non è stata classificata come protezione: oggi `unprotectedRisk = 100 × 100 = 10000` (errato). Con il guard nuovo: applico `max(0, 100−95) × 100 = 500` ✓
3. **CC sintetica ITM**: spot 180, short CALL 170, long CALL 150, qty 1 → `(170−150) × 1 × 100 = 2000` ✓ (oggi avrebbe usato market value della long call, sovrastimando).
4. **CC sintetica OTM**: spot 160, short CALL 170, long CALL 150, market price long call 12 → `12 × 1 × 100 = 1200` ✓.
5. **Currency/Sector**: i totali equivalgono alla somma di stock reali + sintetiche, quindi `grandTotal` Currency rimane invariato in valore (cambia solo la classificazione interna).
6. **GP / Aggregato globale**: l'orchestrazione nell'aggregato somma il nuovo totale e concatena gli array per portafoglio, mantenendo consistenza.

## File toccati

- `src/lib/riskCalculator.ts`
- `src/hooks/useRiskAnalysis.ts`
- `src/components/risk/EquityExposureView.tsx`
- `src/lib/sectorExposure.ts`
- `src/lib/currencyExposure.ts`
- `src/components/risk/HoldingBreakdownDialog.tsx` (verifica)

Nessuna modifica a DB, edge functions, parser Excel o `derivativeStrategies.ts`.
