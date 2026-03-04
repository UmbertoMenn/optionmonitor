

## Fix: tooltip operazioni più facile da attivare

### Problema

Il `<Tooltip>` di Recharts snappa al punto dati più vicino sull'asse X. Con centinaia di barre giornaliere, i punti con operazioni sono rari e il cursore snappa quasi sempre a una barra adiacente senza operazione. I dot grandi non aiutano perché il tooltip si basa sulla prossimità X, non sulla dimensione del dot.

### Soluzione

Aggiungere un layer `<Scatter>` sovrapposto alla `<Line>` per i soli punti con operazione. I punti Scatter hanno detection hover **indipendente** dalla Line e possono avere una shape molto grande (raggio 14-16px) con fill trasparente che funge da hit-area ampia. Quando il cursore entra nell'area dello Scatter, il tooltip mostra i dati di quel punto (con l'operazione).

### Modifiche in `src/components/simulator/BacktestChart.tsx`

1. **Import `Scatter`** da recharts
2. **Preparare dati scatter**: nel `useMemo`, creare un array `scatterData` con solo i punti che hanno `adjustmentDesc`, con proprietà `price` per posizionarli correttamente sull'asse Y
3. **Custom Scatter shape**: componente che renderizza un cerchio arancione visibile (`r={7}`) più un cerchio trasparente grande (`r={18}`) come hit-area
4. **Aggiungere `<Scatter>`** al `<ComposedChart>`:
   - `data={scatterData}`, `dataKey="price"`
   - `shape={<CustomScatterDot />}` con hit-area ampia
   - Stesso asse Y della Line
5. **Rimuovere `dot` e `activeDot`** dalla `<Line>` (i pallini vengono ora dallo Scatter)
6. **Tooltip**: resta invariato, riceve i dati del punto Scatter quando attivato da hover sullo scatter

```text
  ComposedChart
  ├── Line  (prezzo, senza dot)
  ├── Scatter (solo punti operazione, dot arancioni grandi con hit-area)
  └── Tooltip (mostra prezzo + operazione)
```

Risultato: basta avvicinare il cursore entro ~18px da un pallino arancione per far apparire il tooltip con i dettagli dell'operazione. Non serve più centrare il cursore esattamente sulla data.

