

## Fix performance "Riconfigura strategie" + aggiungere bottone +N al Wizard

### Problema 1: Blocco pagina
Il bottone "Riconfigura strategie" apre il wizard che chiama `handleAutoClassify` (o `restoreFromConfigs`) in modo sincrono, bloccando il main thread. `categorizeDerivatives` è pesante con molte posizioni.

### Problema 2: Bottone +N mancante nel Wizard
Il bottone "+N Aggiungi" per aggiungere posizioni selezionate a una strategia esistente esiste solo nel dialog di riconciliazione (`StrategyReconciliationDialog`), ma non nel wizard principale (`StrategyConfigWizard`).

---

### Modifiche a `src/components/derivatives/StrategyConfigWizard.tsx`

**1. Performance — wrappare in `startTransition`**
- Importare `startTransition` da React
- Wrappare `handleAutoClassify` in `startTransition` per evitare il blocco UI
- Wrappare anche il `setStrategies` nel `useEffect` di restore

**2. Aggiungere funzione `addToStrategy`**
Stessa logica del reconciliation dialog:

```typescript
const addToStrategy = (groupKey: string, strategyId: string, groupPositions: Position[]) => {
  const selectedSet = selectedIdsByGroup.get(groupKey);
  if (!selectedSet || selectedSet.size === 0) return;
  const available = groupPositions.filter(p => !assignedIds.has(p.id));
  const toAdd = available.filter(p => selectedSet.has(p.id));
  if (toAdd.length === 0) return;

  setStrategies(prev => prev.map(st => {
    if (st.id !== strategyId) return st;
    const newPositions = [...st.positions, ...toAdd];
    return { ...st, positions: newPositions, suggestedType: detectStrategyType(newPositions) };
  }));
  setSelectedIdsByGroup(prev => { const next = new Map(prev); next.delete(groupKey); return next; });
};
```

**3. Aggiungere bottone +N nella UI strategia** (riga ~804)
Tra il blocco sintetica e il cestino, aggiungere il bottone condizionale:

```text
[Select tipo ▾]  [✓ Auto]  [⚡ Sintetica]  [+N Aggiungi]  [🗑]
```

Il bottone appare solo se `selectedCount > 0` per quel `groupKey`.

### File da modificare
- `src/components/derivatives/StrategyConfigWizard.tsx` — `startTransition` + `addToStrategy` + bottone +N

