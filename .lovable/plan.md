

## Bug: Il restore delle configurazioni non viene mai eseguito

### Causa
Il wizard usa `handleOpenChange` per chiamare `restoreFromConfigs()`, ma questa callback è passata a `Dialog.onOpenChange`, che viene invocata solo quando il dialog si chiude internamente (click fuori, ESC). Quando il parent imposta `open={true}` tramite `setWizardOpen(true)`, il dialog si apre direttamente senza chiamare `onOpenChange(true)` → `restoreFromConfigs()` non viene mai eseguito → 0 strategie.

### Soluzione
Aggiungere un `useEffect` che osserva la prop `open` e, quando diventa `true`, esegue il restore:

```typescript
useEffect(() => {
  if (open) {
    const restored = restoreFromConfigs();
    setStrategies(restored);
    setSelectedIdsByGroup(new Map());
    setSearchQuery('');
  }
}, [open]);
```

E rimuovere la logica di restore da `handleOpenChange`, lasciandola solo come proxy per `onOpenChange`.

### File da modificare
**`src/components/derivatives/StrategyConfigWizard.tsx`** — sostituire la logica in `handleOpenChange` con un `useEffect` su `open`.

