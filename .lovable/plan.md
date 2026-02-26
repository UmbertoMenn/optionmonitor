

## Piano: Asse X lineare nel tempo + etichette sintetiche

### Problema
Entrambi i grafici (PerformanceEvolutionChart e PortfolioEvolutionChart) usano `type="category"` sull'asse X, che distribuisce i punti in modo equidistante indipendentemente dalla distanza temporale reale. Inoltre `interval={0}` mostra tutte le etichette, illeggibili con molti datapoint (es. aggregato).

### Soluzione
Passare a `type="number"` con un campo `timestamp` (epoch ms) come `dataKey` dell'asse X. Questo distribuisce i punti proporzionalmente al tempo reale. Per le etichette, usare un `tickFormatter` che converte il timestamp in data leggibile e limitare il numero di tick con una funzione che calcola `ticks` appropriati in base al range temporale.

### Modifiche

**File 1: `src/components/dashboard/charts/PerformanceEvolutionChart.tsx`**
1. Aggiungere campo `timestamp: number` (epoch ms) a `ChartDataPoint`
2. Popolare `timestamp` con `new Date(entry.snapshot_date).getTime()` in `chartData`
3. Modificare XAxis:
   - `dataKey="timestamp"` + `type="number"` + `domain={['dataMin', 'dataMax']}`
   - `scale="time"` rimosso (usiamo number puro)
   - `tickFormatter` che formatta timestamp → `"MMM ''yy"` (es. "Gen '25")
   - `ticks` calcolati: ~5-7 tick equidistanti nel range temporale
   - Rimuovere `interval={0}`
4. Tooltip `labelFormatter`: riceve il timestamp, formattare come `"dd MMM ''yy"`

**File 2: `src/components/dashboard/charts/PortfolioEvolutionChart.tsx`**
1. Stesse modifiche: aggiungere `timestamp`, cambiare XAxis a `type="number"`, tick formatter, ticks calcolati
2. Tooltip `labelFormatter`: formattare timestamp → data leggibile

### Funzione helper per calcolo ticks
```typescript
function computeTimeTicks(data: { timestamp: number }[], maxTicks = 6): number[] {
  if (data.length <= maxTicks) return data.map(d => d.timestamp);
  const min = data[0].timestamp;
  const max = data[data.length - 1].timestamp;
  const step = (max - min) / (maxTicks - 1);
  return Array.from({ length: maxTicks }, (_, i) => min + step * i);
}
```

Questo garantisce:
- Spaziatura proporzionale al tempo reale
- Max ~6 etichette leggibili anche con 100+ datapoint (aggregato)
- Formato compatto "Gen '25" per le etichette asse

