

## Rework del Breakdown Netting nella Dashboard

### Stato attuale
Il carousel netting ha 2 slide: (1) confronto barre orizzontali Assets vs Nettato, (2) istogramma verticale con categorie strategia (CC ITM, CC OTM, NP ITM, NP OTM, Long Put, Leap Call, Altre). Le categorie sono basate sulla classificazione `categorizeDerivatives`.

### Cosa cambia
Il carousel netting passerà a **3 slide**:

1. **Slide 1** (invariata): Confronto "Valore Assets" vs "Valore Nettato"
2. **Slide 2** (NUOVA — sostituisce l'attuale breakdown): **Breakdown per tipo opzione**, con 4 barre:
   - PUT Vendute ITM → valore intrinseco (strike - sottostante) × contratti × 100 / cambio
   - CALL Vendute ITM → valore intrinseco (sottostante - strike) × contratti × 100 / cambio
   - PUT Vendute OTM → prezzo mercato × contratti × 100 / cambio
   - CALL Vendute OTM → prezzo mercato × contratti × 100 / cambio
   - Tooltip: lista ticker + valore EUR per ciascuna barra
   - Valore totale blu sotto il grafico = somma delle 4 barre

3. **Slide 3** (NUOVA): **Breakdown per sezione strategia** (come nella pagina Derivati):
   - Una barra per ogni sezione strategia che contiene posizioni (Covered Call, Naked Put, Iron Condor, ecc.)
   - Barre nascoste se la sezione è vuota
   - Se non esistono strategy_configurations salvate → messaggio di avviso con link alla configurazione
   - Tooltip: ticker raggruppato per sottostante + valore
   - Per strategie multi-gamba o multiple sullo stesso sottostante: somma valori e raggruppa per underlying

### Dettaglio tecnico

#### 1. `src/hooks/useDerivativeNetting.ts`
- Aggiungere al risultato di `computeSinglePortfolioNetting` un nuovo campo `optionTypeBreakdown` con 4 bucket:
  - `sold_put_itm`: per ogni PUT venduta (quantity < 0) dove strike >= underlyingPrice → calcolo intrinseco
  - `sold_call_itm`: per ogni CALL venduta (quantity < 0) dove strike < underlyingPrice → calcolo intrinseco
  - `sold_put_otm`: per ogni PUT venduta dove strike < underlyingPrice → valore mercato
  - `sold_call_otm`: per ogni CALL venduta dove strike >= underlyingPrice → valore mercato
- Determinazione ITM/OTM: usare snapshot_price del sottostante in portafoglio, con fallback su `underlyingPrices`
- Cambio EUR/USD: usare `exchange_rate` dalla posizione (già presente dal parser Excel)
- Ogni detail nel bucket: `{ ticker, value (EUR), valueUsd (opzionale) }`
- Aggiungere `optionTypeBreakdown` a `NettingResult`

#### 2. `src/hooks/useDerivativeNetting.ts` — nuovo campo `strategyBreakdown`
- Aggiungere campo `strategyBreakdown: NettingBreakdownItem[]` al risultato
- Raggruppare posizioni per sezione strategia (dalla classificazione `categorizeDerivatives`)
- Per ogni sezione con posizioni: sommare i netting values di tutte le gambe, raggruppare dettagli per underlying
- Sezioni: Covered Call, De-Risking CC, Naked Put, Iron Condor, Double Diagonal, Leap Call, Protezioni, Altre Strategie (+ eventuali grouped come Put Spread, Diagonal Put Spread)

#### 3. `src/components/dashboard/DynamicPortfolioChart.tsx`
- Aggiungere slide 3 al carousel netting
- **Slide 2**: nuovo componente `OptionTypeBreakdownChart` che mostra le 4 barre con tooltip per ticker
- **Slide 3**: nuovo componente `StrategyBreakdownChart` che:
  - Se `existingConfigs` (da `useStrategyConfigurations`) è vuoto → mostra avviso "Configura le strategie" con link a `/derivatives`
  - Altrimenti mostra una barra per ogni sezione strategia non vuota
  - Tooltip con dettagli per underlying
- Aggiornare `nettingSlides` a 3 elementi e i dot indicators

#### 4. Passaggio dati
- `Dashboard.tsx` già passa `netting` e `positions` a `DynamicPortfolioChart`
- Aggiungere prop `strategyConfigs` (o fetch diretto nel componente) per verificare se esistono configurazioni salvate
- I nuovi breakdown sono calcolati nel hook esistente, nessun fetch aggiuntivo necessario

### File da modificare
1. **`src/hooks/useDerivativeNetting.ts`** — aggiungere `optionTypeBreakdown` e `strategyBreakdown` ai risultati
2. **`src/components/dashboard/DynamicPortfolioChart.tsx`** — nuovi componenti chart + terza slide carousel
3. **`src/components/dashboard/Dashboard.tsx`** — passare eventuali props aggiuntive (strategy configs)

