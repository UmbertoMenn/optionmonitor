

## Suddivisione Covered Call standard vs sintetiche + fix Accenture

### Problema 1: Accenture classificata male
Il case `derisking_covered_call` in Step 0.5 cerca `remaining.find(d => d.option_type === 'put' && d.quantity < 0)` per la synthetic PUT, ma questa viene trovata PRIMA di filtrare `boughtPuts`. Risultato: la sold PUT viene presa sia come `syntheticPut` sia potenzialmente confusa con le bought puts. Se il matching fallisce (es. non ci sono bought puts rimaste dopo lo shift), la call va in CC standard e le put in "other".

**Root cause**: quando `is_synthetic=true`, la PUT venduta deep ITM deve essere trattata come "stock equivalente" e NON deve finire in `boughtPuts`. Inoltre, se non ci sono PUT comprate protettive, la strategia deve comunque rimanere come CC sintetica (non derisking), non frammentarsi.

### Problema 2: Nessuna sezione separata per CC sintetiche
Attualmente `coveredCalls` contiene sia standard che sintetiche senza distinzione. Serve una sezione separata con tendina dedicata che, quando aperta, mostri la gamba PUT venduta deep ITM.

### Piano

#### File 1: `src/lib/derivativeStrategies.ts`

**A. Nuova interfaccia `SyntheticCoveredCallPosition`:**
```typescript
export interface SyntheticCoveredCallPosition {
  option: Position;           // CALL venduta
  syntheticPut: Position;     // PUT venduta deep ITM (sostituto stock)
  contracts: number;
}
```

**B. Aggiungere `syntheticCoveredCalls` a `DerivativeCategories`**

**C. Fix Step 0.5 `derisking_covered_call` con `is_synthetic=true`:**
- Isolare la sold PUT come `syntheticPut` PRIMA di filtrare boughtPuts
- Se ci sono bought puts protettive → `deRiskingCoveredCalls` (sintetica)
- Se NON ci sono bought puts → `syntheticCoveredCalls` (CC sintetica senza protezione)

**D. Fix Step 0.5 `covered_call`:** se `is_synthetic` nel config, mandare a `syntheticCoveredCalls` invece di `coveredCalls`

#### File 2: `src/pages/Derivatives.tsx`

**E. Nuova sezione "Covered Call Sintetiche"** tra Covered Call e De-Risking:
- Ordine: 1. CC Standard → 2. CC Sintetiche → 3. De-Risking CC → ...
- Icona: Shield + badge "S" arancione
- Descrizione: "CALL vendute con PUT venduta deep ITM al posto del sottostante"
- Ogni riga mostra la CALL venduta (come CoveredCallRow) con PMC, prezzo, gain/loss %
- Tendina espansa: mostra la gamba PUT venduta deep ITM con strike, scadenza, PMC, prezzo

**F. Nuovo componente `SyntheticCoveredCallRow`:**
- Riga principale: stesse colonne di CoveredCallRow (V badge, descrizione, OptionStrat, ITM/OTM, menu, calculator, UNIT, PS, contratti, PMC, prezzo+%)
- Badge "S" arancione accanto alla descrizione
- Collapsible: dettagli PUT sintetica (strike, scadenza, PMC, prezzo, P/L%)

**G. Stato e wiring:** aggiungere `syntheticCCOpen` state, rendering della sezione, aggiungere underlyings alla lista prezzi

#### File 3: `src/components/derivatives/StrategyConfigWizard.tsx`
- Nessuna modifica necessaria: il wizard già gestisce `is_synthetic` flag

### Ordine sezioni finale
1. Covered Call (standard, con azioni reali)
2. Covered Call Sintetiche (con PUT venduta deep ITM)
3. De-Risking Covered Call (CC + protezione, standard o sintetiche)
4. Iron Condor
5. Double Diagonal
6. Naked Put
7. Leap Call
8. Protezioni
9. Altre Strategie

### File da modificare
1. `src/lib/derivativeStrategies.ts` — nuova interfaccia, nuovo array, fix Step 0.5
2. `src/pages/Derivatives.tsx` — nuova sezione, nuovo componente row, riordino

