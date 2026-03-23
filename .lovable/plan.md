

## Fix: Scroll non funzionante nel wizard configurazione strategie

### Problema
Il `DialogContent` ha `max-h-[90vh] flex flex-col` e il contenuto è dentro un `<ScrollArea>` (Radix), ma il `ScrollArea` non ha un'altezza esplicita — solo `flex-1`. In molti casi Radix ScrollArea non calcola correttamente l'altezza con solo `flex-1`, impedendo sia lo scroll con rotellina che la visualizzazione della scrollbar.

### Soluzione
Sostituire `<ScrollArea className="flex-1 pr-2">` con un semplice `<div>` che usa `overflow-y-auto` e `min-h-0` (necessario in flex column per permettere lo shrink):

```tsx
<div className="flex-1 min-h-0 overflow-y-auto pr-2">
```

Questo approccio:
- Abilita lo scroll nativo con rotellina
- Mostra la scrollbar del browser
- Funziona correttamente in flex column con `min-h-0`

### File da modificare
- `src/components/derivatives/StrategyConfigWizard.tsx` — riga 312: sostituire `<ScrollArea>` con `<div>` con overflow, e chiusura corrispondente

