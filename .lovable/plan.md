

## Fix definitivo: GOOGLE non deve finire in Posizioni Orfane

### Perché succede ancora

Ho trovato due problemi reali nel codice attuale, non uno solo.

#### 1) Il netting non usa davvero la stessa fonte della pagina Strategie Derivati
In `src/hooks/useDerivativeNetting.ts`, `buildCanonicalLegs()` ricostruisce le gambe leggendo:
- `coveredCalls`
- `deRiskingCoveredCalls`
- `ironCondors`
- `doubleDiagonals`
- `nakedPuts`
- `longPuts`
- `leapCalls`
- `groupedOtherStrategies`

Ma la fonte più affidabile della pagina Derivati è `resolvedConfigs[].matchedPositions` dentro `categorizeDerivatives(...)`.

Questo conta perché una config può avere `matchedVirtual` corretti, ma non entrare nelle sezioni finali per le regole di costruzione della categoria. In quel caso:
- la pagina/config sa che la strategia esiste
- il netting non prende quei `matchedPositions`
- la quantità resta “non consumata”
- il residuo finisce in `orphans`

È esattamente il tipo di bug che spiega GOOGLE o MU nelle orfane pur essendo configurati.

#### 2) La dashboard non tratta correttamente l’aggregato utente
La pagina Derivati, quando `isAggregatedView` è true, categorizza **per portfolio** e poi mergea i risultati.
La dashboard invece passa a `useDerivativeNetting(...)` solo `isGlobalAggregate`, quindi fa lo split per portfolio solo nell’aggregato globale admin, non nell’aggregato utente.

Quindi su “Il Mio Aggregato” il netting può mischiare:
- posizioni di portfolio A
- config di portfolio B

Questo crea falsi residui e quindi falsi orfani.

---

## Cosa implementare

### A. Rifare il netting partendo da `resolvedConfigs.matchedPositions`
**File:** `src/hooks/useDerivativeNetting.ts`

Sostituire l’attuale `buildCanonicalLegs()` con una costruzione canonica basata su:
- `categorizeDerivatives(..., { configOnly: true })`
- `categories.resolvedConfigs`

Per ogni `resolvedConfig`:
- usare **direttamente** `matchedPositions`
- mappare la `strategyType` alla categoria netting:
  - `covered_call` → `covered_call`
  - `derisking_covered_call` → `derisking_cc`
  - `iron_condor` → `iron_condor`
  - `double_diagonal` → `double_diagonal`
  - `naked_put` → `naked_put`
  - `put_spread` → `put_spread`
  - `diagonal_put_spread` → `diagonal_put_spread`
  - `leap_call` → `leap_call`
  - `other` → `other`

Per CC / De-Risking / Naked Put mantenere il riferimento a `linkedStock` del `resolvedConfig` per i calcoli intrinseci.

Questo elimina la dipendenza dalle sezioni display e usa la vera sorgente configurata.

---

### B. Calcolare gli orfani solo come residui veri
Sempre in `src/hooks/useDerivativeNetting.ts`:

Per ogni derivato originale:
- sommare quanta quantità è stata consumata dai `matchedPositions` delle config
- usare `sourceId` = id raw senza suffissi virtuali
- creare orfano solo se:
```text
residuo = |qty originale| - qty consumata > 0
```

Il residuo va creato proporzionalmente su:
- `quantity`
- `market_value`
- `snapshot_market_value`
- `profit_loss`

Così GOOGLE finisce in orfani solo se resta davvero una parte non assegnata alla config.

---

### C. Separare SEMPRE per portfolio nelle viste aggregate
**File:** `src/hooks/useDerivativeNetting.ts`

L’hook deve smettere di usare il solo booleano `isGlobalAggregate`.
Va introdotta la logica “aggregated view” coerente con la pagina Derivati:
- raggruppare sempre per `portfolio_id` quando sono presenti più portfolio nella vista
- applicare `computeSinglePortfolioNetting(...)` separatamente per ogni portfolio
- poi fare merge del breakdown

Questo rende coerente dashboard e pagina Derivati sia per:
- aggregato globale admin
- aggregato utente

---

### D. Non derivare più il breakdown “ex CC / ex CC&NP” dalle sezioni visuali
**File:** `src/hooks/useDerivativeNetting.ts`

Anche `getBreakdownForViewMode(...)` deve usare la stessa lista canonica di leg costruita da `resolvedConfigs + residui`, non le categorie ricostruite.

Regole:
- `netting_total`: market value pieno
- `netting_ex_cc`: per `covered_call` e `derisking_cc` usare solo perdita intrinseca ITM della sold call, con cap al costo di chiusura
- `netting_ex_cc_np`: stessa regola + naked put ITM intrinseca capped
- tutte le altre categorie, inclusi `orphans`: market value pieno

---

### E. Rendere visibile la differenza tra config matchata e config degradata
**File:** `src/lib/derivativeStrategies.ts`

Nel ramo `configOnly`, oltre a `resolvedConfigs`, rendere esplicito quando una config è:
- `matched`
- `partial`
- `unmatched`

e usare questi stati nel netting:
- `matched` / `partial`: i `matchedPositions` vanno comunque consumati
- `unmatched`: nessun consumo, tutto residuo → `orphans`

Questo evita che una config parzialmente riconosciuta venga persa completamente.

---

### F. Sistemare il bug delle config rimaste con tipo sbagliato dopo variazione gambe
**Problema esempio:** META era Iron Condor, poi resta a 3 gambe, ma nel DB la config è ancora `iron_condor`.

#### Fix
**File:** `src/lib/strategyReconciliation.ts`  
**File:** `src/components/derivatives/StrategyReconciliationDialog.tsx`

Estendere la riconciliazione in modo che:
- una config con leg mancanti sia marcata `isDegraded`
- se il set di leg residuo corrisponde a un altro tipo rilevabile, venga proposta una conversione suggerita
- al salvataggio, la nuova config sostituisca quella obsoleta

Esempio:
- META 4 leg → 3 leg
- non deve più essere considerata iron condor valida
- non deve sparire nel nulla
- fino a riconfigurazione, le gambe effettivamente matchate/non matchate devono ricadere correttamente negli orfani/residui
- nel dialogo va proposta la correzione o rimozione

---

## File da modificare

1. `src/hooks/useDerivativeNetting.ts`
   - rifare `buildCanonicalLegs()` usando `resolvedConfigs.matchedPositions`
   - consumo quantity-aware dai `resolvedConfigs`
   - split per portfolio in tutte le viste aggregate
   - allineare anche `getBreakdownForViewMode()`

2. `src/lib/derivativeStrategies.ts`
   - esporre meglio i `resolvedConfigs` come fonte canonica del match
   - mantenere `status` affidabile per matched/partial/unmatched

3. `src/lib/strategyReconciliation.ts`
   - rafforzare detection config degrade/obsolete

4. `src/components/derivatives/StrategyReconciliationDialog.tsx`
   - proporre pulizia/correzione delle config degradate

---

## Risultato atteso

Per GOOGLE:
- se è davvero dentro una covered call sintetica/de-risking configurata, non apparirà più in `Posizioni Orfane`

Per MU:
- se è configurata come Double Diagonal e i `matchedPositions` esistono, resterà in Double Diagonal

Per META degradata:
- non verrà mostrata come Iron Condor valida
- le gambe residue finiranno correttamente tra i residui/orfani finché non viene riconfigurata
- la UI proporrà la correzione della config

Per la home:
- il netting userà finalmente la stessa base logica della pagina Strategie Derivati
- niente più casi in cui una posizione configurata sparisce dalla sezione giusta e riappare negli orfani

## Dettagli tecnici

```text
Nuova sorgente canonica netting:
categorizeDerivatives(..., { configOnly: true })
  -> resolvedConfigs[]
     -> matchedPositions[]

Orfani:
raw derivative qty
- somma qty matchedPositions con stesso sourceId
= residuo reale

Aggregato:
group by portfolio_id
computeSinglePortfolioNetting per portfolio
merge breakdown finale
```

