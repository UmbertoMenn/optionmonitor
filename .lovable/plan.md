

## Pallini arancioni + area di attivazione tooltip più ampia

### Modifiche in `src/components/simulator/BacktestChart.tsx`

1. **Colore pallini → arancione**: Nel `CustomDot`, cambiare `fill="hsl(var(--primary))"` in `fill="#f97316"` (arancione Tailwind `orange-500`) e aumentare il raggio a `r={7}` per renderli più visibili.

2. **Tooltip più facile da attivare**: Usare `activeDot` con raggio grande invisibile sui punti con operazioni, e aggiungere un layer di dot invisibili più grandi (`r={14}`) come hit area. In pratica:
   - Rendere i dot visibili con `r={7}` arancioni
   - Aggiungere `activeDot` con `r={9}` arancione più luminoso al passaggio
   - Impostare sulla `<Line>` la prop `activeDot` con un componente custom che mostra un dot grande solo sui punti con operazione
   - Usare un secondo `<Line>` invisibile (scatter-like) con `dot` di raggio grande (`r={20}`, `fillOpacity={0}`) solo sui punti con operazione, così l'area cliccabile/hoverable è molto più ampia

**Approccio scelto (più semplice e affidabile):**
- `CustomDot`: `r={7}`, `fill="#f97316"`, `stroke` bianco
- `CustomActiveDot`: `r={10}`, `fill="#fb923c"`, animazione pulse
- Sulla `<Line>`, impostare `activeDot={<CustomActiveDot />}` — recharts gestisce l'hover con snapping al punto più vicino quando si usa `<Tooltip />` senza `trigger="click"`
- Aggiungere alla `<ComposedChart>` la prop `margin` adeguata
- **Cruciale**: Nel `<Tooltip>`, NON filtrare — il tooltip standard di recharts già fa snap al punto più vicino lungo l'asse X. Il problema attuale è che `CustomTooltip` mostra info solo se c'è `adjustmentDesc`. Va bene così — ma per rendere il tooltip "magnetico" sui pallini, basta NON usare `isAnimationActive={false}` e lasciare il comportamento default di recharts che snappa al datapoint più vicino.

Il tooltip di recharts già snappa al punto X più vicino al cursore — il problema è che i dot sono piccoli (`r=5`). Ingrandendoli e aggiungendo `activeDot` più grande, l'esperienza migliora significativamente.

