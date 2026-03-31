

## Aggiungere gambe a strategie esistenti nel dialog di riconciliazione

### Problema
Quando una gamba di un Iron Condor cambia (es. rollover), il dialog mostra 3 gambe nella strategia esistente e la nuova gamba nel pool "Posizioni disponibili". L'unico modo per risolvere è cancellare la strategia e ricrearla con tutte e 4 le gambe. Serve poter aggiungere direttamente una posizione dal pool a una strategia esistente.

### Soluzione
Aggiungere un meccanismo per trasferire posizioni selezionate dal pool direttamente dentro una strategia già configurata, con un bottone "+" su ogni card strategia.

### Modifiche a `src/components/derivatives/StrategyReconciliationDialog.tsx`

**1. Nuova funzione `addToStrategy`**
- Parametri: `groupKey`, `strategyId`, `positionIds: string[]`
- Sposta le posizioni selezionate dal pool (`availablePositions`) dentro `strategy.positions`
- Ricalcola `suggestedType` con `detectStrategyType` dopo l'aggiunta
- Pulisce la selezione

**2. Bottone "Aggiungi selezionate" su ogni card strategia**
- Visibile solo quando ci sono posizioni selezionate nel pool per quel sottostante
- Posizionato accanto al bottone cestino nella riga header della strategia
- Al click chiama `addToStrategy` con le posizioni selezionate
- Label: icona `Plus` + numero selezionate (es. "+2")

**3. UI aggiornata per ogni strategia**
Nella riga header di ogni strategia (riga ~605-651), aggiungere tra il select e il cestino:

```text
[Select tipo ▾]  [✓ Auto]  [⚡ Sintetica]  [+2 Aggiungi]  [🗑]
```

Il bottone "+N Aggiungi" appare solo se `selectedCount > 0` per quel `groupKey`.

### Dettaglio tecnico

```typescript
const addToStrategy = (groupKey: string, strategyId: string) => {
  const state = underlyingStates.get(groupKey);
  if (!state) return;
  const selectedSet = selectedByGroup.get(groupKey);
  if (!selectedSet || selectedSet.size === 0) return;
  
  const toAdd = state.availablePositions.filter(
    p => selectedSet.has(p.id) && !assignedIds.has(p.id)
  );
  if (toAdd.length === 0) return;

  setUnderlyingStates(prev => {
    const next = new Map(prev);
    const s = { ...next.get(groupKey)! };
    s.strategies = s.strategies.map(st => {
      if (st.id !== strategyId) return st;
      const newPositions = [...st.positions, ...toAdd];
      return { ...st, positions: newPositions, suggestedType: detectStrategyType(newPositions) };
    });
    s.availablePositions = s.availablePositions.filter(p => !selectedSet.has(p.id));
    next.set(groupKey, s);
    return next;
  });
  setSelectedByGroup(prev => {
    const next = new Map(prev);
    next.delete(groupKey);
    return next;
  });
};
```

### File da modificare
- `src/components/derivatives/StrategyReconciliationDialog.tsx` — aggiungere `addToStrategy` + bottone nella UI strategia

