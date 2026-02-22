

## Modifiche UI al Simulatore

### 1. Rimuovere i toggle Switch dalle regole di aggiustamento

Rimuovere gli `Switch` a destra dei titoli "Se il prezzo si avvicina alla call venduta" e "Se l'opzione venduta sta guadagnando" in `AdjustmentRuleEditor.tsx`. Le regole saranno sempre attive (rimuovere anche la logica `enabled` e il wrapper condizionale).

**File:** `src/components/simulator/AdjustmentRuleEditor.tsx` (righe 42-48, 50, 178, 185-191, 193, 325)
- Rimuovere `<Switch>` da entrambe le sezioni
- Rimuovere `{rules.approachRule.enabled && (` e `{rules.profitRule.enabled && (`
- Il contenuto e sempre visibile

**File:** `src/lib/adjustmentRules.ts` - Rimuovere `enabled` da `ApproachRule` e `ProfitRule` interfaces e dai defaults.

**File:** `src/lib/backtestEngine.ts` - Rimuovere i check `if (!ccRules.approachRule.enabled)` e `if (!ccRules.profitRule.enabled)` nel loop principale.

---

### 2. Ristrutturare la regola "prezzo si avvicina"

Attualmente le 3 opzioni (roll_up_always, roll_up_positive, do_nothing) sono RadioGroup items. La richiesta e:
- Rimuovere "% del sottostante" dalla sezione roll (lasciare solo USD e distanza min strike)
- "Non faccio nulla, alla scadenza" non deve essere un'opzione radio separata ma un blocco sempre visibile sotto le opzioni di roll, con solo l'input "Barriera nuova call %"
- Rimuovere il sotto-RadioGroup (sell_new_call / rebuy_and_sell) dentro do_nothing

**Nuova struttura:**
```
Se il prezzo si avvicina alla call venduta
  Distanza di attivazione: [__]%
  Cosa fai?
    (o) Rollo su scadenza successiva con strike piu alto (anche se debito)
        Distanza min strike [__]%
    (o) Rollo solo se differenza positiva di almeno: [__] USD
        Distanza min strike [__]%
  Alla scadenza, barriera nuova call: [__]%
```

---

### 3. Ristrutturare la regola "opzione sta guadagnando"

L'ordine delle opzioni radio cambia: "Roll attivo" viene prima di "Aspetto che scada". Rimuovere "% del sottostante" e "% del riacquisto" dalle sotto-sezioni del roll attivo.

**Nuovo ordine:**
```
Se l'opzione venduta sta guadagnando
  Soglia di guadagno: [__]%
  Cosa fai?
    (o) Roll attivo
        [sotto-regole con solo USD e distanza min strike]
    (o) Aspetto che scada e rivendo call con barriera: [__]%
```

Rimuovere i campi `minPremiumPct`, `rollDownMinPremiumPct` dall'interfaccia (lasciare solo USD).

---

### 4. Rimuovere "Applica Strategia" da StrategyBuilder

Il bottone "Applica Strategia" in `StrategyBuilder.tsx` (riga 143-145) viene rimosso. Il bottone "Esegui Backtest" in `Simulator.tsx` applica automaticamente la strategia prima di eseguire.

**File:** `src/components/simulator/StrategyBuilder.tsx`
- Rimuovere il bottone e `handleApply`
- Chiamare `onLegsChange` automaticamente quando `computedLegs` cambia (via `useEffect`)

**File:** `src/pages/Simulator.tsx`
- In `handleRunBacktest`, non serve piu il check `legs.length === 0` perche le legs vengono calcolate automaticamente
- Il bottone "Esegui Backtest" appare quando `priceData` e disponibile (non serve aspettare `legs.length > 0`)

---

### 5. Scroll ai risultati dopo backtest

In `Simulator.tsx`, dopo che `setBacktestResult(result)` viene chiamato, fare scroll automatico alla sezione risultati cosi l'utente vede subito i dati senza che la pagina salti in modo imprevedibile.

**File:** `src/pages/Simulator.tsx`
- Aggiungere un `useRef` per la sezione risultati
- Dopo `setBacktestResult(result)`, usare `ref.current?.scrollIntoView({ behavior: 'smooth' })` con un piccolo timeout per aspettare il render

---

### Riepilogo file modificati

| File | Modifiche |
|------|-----------|
| `src/components/simulator/AdjustmentRuleEditor.tsx` | Rimuovere toggle, ristrutturare entrambe le regole |
| `src/components/simulator/StrategyBuilder.tsx` | Rimuovere bottone "Applica Strategia", auto-sync legs |
| `src/pages/Simulator.tsx` | Auto-apply legs, scroll ai risultati, bottone visibile con solo priceData |
| `src/lib/adjustmentRules.ts` | Rimuovere `enabled` dalle interfacce e defaults |
| `src/lib/backtestEngine.ts` | Rimuovere check `enabled` |

