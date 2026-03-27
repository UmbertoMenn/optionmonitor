

## Fix bug visualizzazione frecce scroll nel wizard

### Problema
La freccia "scroll down" si sovrappone al pulsante "Salva Configurazione" in basso a destra perché è posizionata con `absolute bottom-1` dentro il container relativo, ma visivamente cade sopra il footer del dialog.

### Soluzione in `src/components/derivatives/StrategyConfigWizard.tsx`

1. **Spostare le frecce DENTRO l'area scrollabile** anziché fuori — posizionarle come `sticky` top/bottom dentro il `div` con `overflow-y-auto`, così restano confinate nell'area di scroll e non invadono il footer.

2. In alternativa (più semplice e pulito): cambiare il posizionamento delle frecce per usare `pointer-events-none` sul wrapper e dare un margine/padding adeguato, oppure semplicemente aumentare il `bottom` a ~`bottom-3` e aggiungere un piccolo gradiente sfumato per separare visivamente la freccia dal contenuto sottostante.

**Approccio scelto**: Rendere le frecce `sticky` dentro il container scrollabile. Questo le tiene sempre visibili nell'area di scroll senza sovrapporsi al footer.

```
ScrollArrowsContainer:
- Rimuovere il wrapper `relative`
- Mettere le frecce come figli `sticky top-0` e `sticky bottom-0` dentro il div scrollabile
- Usare z-index e bg semi-trasparente per le frecce
```

