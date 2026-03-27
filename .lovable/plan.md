

## Aggiungere frecce di scorrimento al wizard strategie derivati

### Cosa cambia

Aggiungere due piccoli pulsanti freccia (ChevronUp / ChevronDown) posizionati lungo il bordo destro dell'area scrollabile del wizard (il `div` a riga 472 con `overflow-y-auto`). Le frecce appaiono/scompaiono in base alla posizione di scroll interna, analogamente al componente `ScrollArrows` esistente ma applicato al contenitore interno del dialog anziché alla finestra.

### Implementazione in `src/components/derivatives/StrategyConfigWizard.tsx`

1. Aggiungere un `useRef` per il contenitore scrollabile e stati `showUp` / `showDown`
2. Aggiungere un `onScroll` handler + `useEffect` con ResizeObserver per aggiornare la visibilità delle frecce
3. Wrappare il `div.overflow-y-auto` in un `div.relative` e posizionare le frecce come `absolute` sul lato destro (top/bottom), semitrasparenti, con click che scrolla di 200px
4. Stile coerente con `ScrollArrows` (bordo, bg-card, hover primary)

