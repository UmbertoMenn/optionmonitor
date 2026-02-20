

## Ristrutturazione Simulatore: Covered Call con Regole Interattive

### Panoramica

Semplificazione radicale del simulatore: focus esclusivo su **Covered Call**, IV statica (singolo valore), ticker estratto dal CSV, backtest a timeframe nativo (orario/4h/daily), e regole di aggiustamento basate su domande interattive.

---

### 1. TickerSelector -- Estrazione ticker dal CSV

Il ticker viene estratto automaticamente dal nome del file o da una colonna del CSV (es. "Symbol", "Ticker"). Il campo manuale diventa un fallback editabile pre-popolato.

Logica di estrazione:
- Cerca una colonna "ticker" / "symbol" nel CSV e prende il primo valore
- Se non trovata, estrae dal nome file (es. `PLTR_4h.csv` -> `PLTR`)
- Il campo resta editabile ma pre-compilato

**File**: `src/components/simulator/TickerSelector.tsx`

---

### 2. Eliminare IVCurveEditor -- IV statica

Rimuovere completamente il componente `IVCurveEditor.tsx` e la card grafica. Al suo posto, un semplice campo numerico "Volatilita Implicita (%)" nella pagina Simulator (accanto al risk-free rate). Default: 30%.

La funzione `buildManualIVSurface` in `ivSurface.ts` viene semplificata: accetta un singolo valore IV (non piu un array di punti) e restituisce un `IVSurface` che ritorna sempre quel valore.

**File eliminato**: `src/components/simulator/IVCurveEditor.tsx`
**File modificato**: `src/lib/ivSurface.ts`, `src/pages/Simulator.tsx`

---

### 3. Solo Covered Call

Rimuovere tutti i preset tranne Covered Call dal `StrategyBuilder`. L'interfaccia si semplifica:
- Stock: quantita fissa 100
- Call venduta: l'admin imposta solo la distanza % dallo strike e la scadenza
- Nessun bottone preset, la strategia e fissa Covered Call
- Rimuovere il bottone "Aggiungi Gamba"

**File**: `src/components/simulator/StrategyBuilder.tsx`

---

### 4. Backtest a timeframe nativo (non solo daily)

Attualmente il backtest itera solo su dati daily. La modifica:
- Il `TickerSelector` **non aggrega piu a daily**. Passa i dati grezzi (orari, 4h, daily) cosi come sono
- Il `backtestEngine` itera su ogni barra del `priceData`, indipendentemente dal timeframe
- La funzione `yearsBetween` rimane invariata (calcola il tempo in frazioni di anno tra due date/datetime)
- Il parser CSV deve preservare anche l'orario se presente (formato ISO: `2024-01-15T14:00:00`)

**File**: `src/components/simulator/TickerSelector.tsx`, `src/lib/backtestEngine.ts`

---

### 5. Calcolo prezzo teorico opzione ad ogni barra

Il backtest gia calcola il prezzo BS per ogni gamba ad ogni iterazione. Questa funzionalita e gia implementata. Si conferma che ad ogni barra del periodo:
1. Si calcola il tempo rimanente alla scadenza (`T`)
2. Si usa la IV statica impostata dall'admin
3. Si calcola il prezzo BS e i Greci
4. Si valutano le regole di aggiustamento

---

### 6. Regole di aggiustamento interattive (Covered Call)

Questa e la parte piu significativa. Le regole attuali vengono sostituite con un sistema a domande specifiche per Covered Call.

#### Struttura dati nuova

```text
CoveredCallRules {
  strikeStep: number           // incremento strike (default 5)
  
  // REGOLA 1: Prezzo si avvicina alla call venduta
  approachRule: {
    enabled: boolean
    activationPct: number      // distanza % di attivazione (es. 2%)
    action: 'roll_up_always' | 'roll_up_positive' | 'do_nothing'
    
    // Per roll_up_always: nessun parametro extra
    // Per roll_up_positive:
    minPremiumUsd: number      // differenza minima in USD
    minPremiumPct: number      // oppure differenza minima in % del sottostante
    
    // Per do_nothing (alla scadenza):
    expiryAction: 'sell_new_call' | 'rebuy_and_sell'
    newCallBarrierPct: number  // barriera % per la nuova call
  }
  
  // REGOLA 2: Opzione sta guadagnando (prezzo sceso molto)
  profitRule: {
    enabled: boolean
    profitPct: number          // soglia di guadagno % (es. 80%)
    action: 'wait_and_sell' | 'roll_down_first_expiry' | 'roll_down_any_expiry'
    
    // Per wait_and_sell:
    newCallBarrierPct: number
    
    // Per roll_down_first_expiry:
    minPremiumUsd: number
    minPremiumPct: number
    
    // Per roll_down_any_expiry:
    minDistancePct: number     // strike minimo lontano x% dal sottostante
    minPremiumUsd: number      // premio minimo rispetto al costo di riacquisto
    minPremiumPct: number      // oppure in %
  }
}
```

#### UI: Editor a Domande

L'editor presenta due sezioni con domande in italiano:

**Sezione 1: "Se il prezzo si avvicina alla call venduta"**
- Input: "Distanza di attivazione (%)" -- default 2%
- Domanda: "Cosa fai?"
  - Opzione A: "Rollo su scadenza successiva con strike piu alto (anche se il nuovo premio e inferiore al costo di riacquisto)"
  - Opzione B: "Rollo su scadenza successiva con strike piu alto, solo se trovo una differenza positiva di almeno X USD oppure X% sul prezzo del sottostante"
    - Campi: min USD, min %
  - Opzione C: "Non faccio nulla. Alla scadenza:"
    - Sub-opzione C1: "Se OTM, vendo altra call con barriera X%"
    - Sub-opzione C2: "Se ITM, ricompro titoli e vendo altra call con barriera X%"

**Sezione 2: "Se l'opzione venduta sta guadagnando"**
- Input: "Soglia di guadagno (%)" -- default 80% (l'opzione ha perso l'80% del valore)
- Domanda: "Cosa fai?"
  - Opzione A: "Aspetto che scada e rivendo call con barriera X%"
    - Campo: barriera %
  - Opzione B: "Se l'opzione e sulla prima scadenza disponibile, rollo su strike piu basso con stessa scadenza, se il nuovo premio e maggiore di almeno X USD o X% del sottostante"
    - Campi: min USD, min %
  - Opzione C: "Se l'opzione e su scadenze successive, cerco un'opzione con strike lontano almeno X% dal sottostante, con la minima scadenza possibile, il cui premio non sia inferiore di X USD o X% rispetto al costo di riacquisto"
    - Campi: min distanza %, min USD, min %

---

### File coinvolti

| File | Azione |
|------|--------|
| `src/components/simulator/TickerSelector.tsx` | Estrazione ticker dal CSV, rimozione aggregazione daily, preserva timeframe nativo |
| `src/components/simulator/IVCurveEditor.tsx` | **Eliminato** |
| `src/components/simulator/StrategyBuilder.tsx` | Solo Covered Call, rimozione preset e gamba custom |
| `src/components/simulator/AdjustmentRuleEditor.tsx` | **Riscritto**: editor a domande per Covered Call |
| `src/lib/adjustmentRules.ts` | Nuova interfaccia `CoveredCallRules`, rimozione vecchie interfacce |
| `src/lib/ivSurface.ts` | `buildStaticIVSurface(iv, riskFreeRate)` con valore singolo |
| `src/lib/backtestEngine.ts` | Nuova logica di valutazione regole Covered Call, supporto timeframe nativo |
| `src/pages/Simulator.tsx` | Rimozione IVCurveEditor, aggiunta campo IV statico, semplificazione flusso |

### Dettaglio tecnico backtestEngine

Il motore viene aggiornato per gestire le nuove regole:

**Regola 1 (approccio alla barriera)**:
- Ad ogni barra, calcola la distanza tra prezzo e strike della call venduta
- Se distanza <= activationPct:
  - `roll_up_always`: chiudi call, vendi nuova call su scadenza successiva (terzo venerdi del mese dopo), strike = roundStrike(S * (1 + barrieraPct/100), strikeStep)
  - `roll_up_positive`: come sopra ma solo se (premio_nuova - costo_riacquisto) >= minPremiumUsd oppure >= S * minPremiumPct/100
  - `do_nothing`: non fare nulla; alla scadenza (T<=0), se OTM vendi nuova call, se ITM ricompra stock e vendi call

**Regola 2 (opzione in guadagno)**:
- Ad ogni barra, calcola il guadagno % della call venduta: (entryPrice - currentPrice) / entryPrice * 100
- Se guadagno >= profitPct:
  - `wait_and_sell`: aspetta scadenza, poi vendi call con barriera X%
  - `roll_down_first_expiry`: se l'opzione e sulla prima scadenza disponibile, cerca strike piu basso con stessa scadenza il cui premio netto sia >= minPremiumUsd o minPremiumPct
  - `roll_down_any_expiry`: cerca tra tutte le scadenze disponibili l'opzione con strike >= S*(1+minDistancePct/100), scadenza minima, premio netto >= minPremiumUsd o minPremiumPct rispetto al riacquisto

