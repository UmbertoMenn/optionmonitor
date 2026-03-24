

## Fix: Visualizzazione strategie dopo configurazione + sezione De-Risking CC mancante

### Problemi identificati

1. **BUG CRITICO**: La sezione "De-Risking Covered Call" non esiste nel rendering della pagina. `categories.deRiskingCoveredCalls` viene calcolato ma **mai visualizzato**. Le posizioni Accenture configurate come CC sintetica finiscono in `deRiskingCoveredCalls` e scompaiono dalla UI.

2. **Ordine sezioni poco intuitivo**: La sezione "Protezioni - Long Put" (section 2) è posizionata prima di Iron Condor / Double Diagonal, il che non ha senso gerarchico.

3. **Posizioni residue non consumate**: In Step 0.5 di `categorizeDerivatives`, se una config `derisking_covered_call` ha posizioni extra (es. sold puts non sintetiche), queste non vengono marcate come usate e finiscono in categorie sbagliate (Steps 1-6).

### Modifiche previste

#### File 1: `src/pages/Derivatives.tsx`

**A. Aggiungere sezione "De-Risking Covered Call"**

Creare un nuovo componente `DeRiskingCoveredCallRow` che mostra per ogni riga:
- Badge "S" arancione se sintetica
- Tutte le gambe (CALL venduta, PUT comprata di protezione, eventuale PUT venduta sintetica)
- PMC, PS (prezzo sottostante real-time), prezzo opzione aggiornato, gain/loss % con colori verde/rosso
- ITM/OTM badge, contratti, OptionStrat link, calcolatrice premi

Aggiungere la sezione collapsibile tra "Covered Call" e "Iron Condor", con icona `Shield + Umbrella`, badge contatore, e rendering di `categories.deRiskingCoveredCalls`.

**B. Riordinare le sezioni in modo intuitivo:**

1. **Covered Call** (CC standard)
2. **De-Risking Covered Call** (CC + protezione, incluse sintetiche)
3. **Iron Condor**
4. **Double Diagonal**
5. **Naked Put**
6. **Leap Call**
7. **Protezioni - Long Put** (spostata qui, dopo le strategie principali)
8. **Altre Strategie**

**C. Sorting per `deRiskingCoveredCalls`**: aggiungere sorting nel `useMemo` delle categories.

#### File 2: `src/lib/derivativeStrategies.ts`

**D. Consumare TUTTE le posizioni residue in Step 0.5**

Alla fine di ogni `case` nello switch di Step 0.5, marcare come usate tutte le posizioni `remaining` che non sono state consumate. Le posizioni non classificabili nel tipo specifico vengono aggiunte a `otherStrategies` come fallback. Questo impedisce che finiscano in categorie sbagliate nei passaggi successivi.

```typescript
// After each case block, mark all remaining as used
const unhandled = remaining.filter(d => !usedDerivatives.has(d.id));
for (const opt of unhandled) {
  otherStrategies.push({ option: opt, underlying: linkedStock || null });
  usedDerivatives.add(opt.id);
}
```

### Dettaglio `DeRiskingCoveredCallRow`

Ogni riga mostra la CALL venduta come riga principale (simile a CoveredCallRow), con in più:
- Badge "S" arancione se `isSynthetic`
- Nel collapsible: dettagli della PUT protettiva e dell'eventuale PUT sintetica
- Stesse colonne di CoveredCallRow: chevron, V badge, descrizione, OptionStrat, badges, ITM/OTM, menu, calculator, UNIT, PS, contratti, PMC, prezzo+%

### File da modificare

1. `src/pages/Derivatives.tsx` — aggiungere sezione De-Risking CC, riordinare sezioni, creare `DeRiskingCoveredCallRow`
2. `src/lib/derivativeStrategies.ts` — consumare posizioni residue in Step 0.5

