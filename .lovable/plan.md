

## Piano aggiornato: Riduzione punti + normalizzazione curva

### Problema completo
Con molti snapshot: (1) troppi dot visibili, (2) la curva stessa è frastagliata perché passa per ogni singolo punto, creando un andamento erratico.

### Soluzione: downsampling dei dati del grafico

Invece di passare tutti i punti a Recharts e nascondere solo i dot, **ridurre i datapoint stessi** passati al grafico. Questo normalizza la curva perché Recharts interpola con `type="monotone"` solo tra i punti forniti.

**Algoritmo di downsampling (Largest-Triangle-Three-Buckets - semplificato):**
- Se i punti sono ≤ `maxPoints` (es. 30): usa tutti
- Altrimenti: mantieni sempre primo e ultimo, seleziona ~28 punti intermedi equidistanti nel tempo
- Il punto `isCurrent` viene sempre preservato

```typescript
function downsampleData<T extends { timestamp: number }>(
  data: T[], 
  maxPoints = 30
): T[] {
  if (data.length <= maxPoints) return data;
  const first = data[0];
  const last = data[data.length - 1];
  const step = (data.length - 2) / (maxPoints - 2);
  const result: T[] = [first];
  for (let i = 1; i < maxPoints - 1; i++) {
    result.push(data[Math.round(i * step)]);
  }
  result.push(last);
  return result;
}
```

### Modifiche

**File 1: `src/components/dashboard/charts/PortfolioEvolutionChart.tsx`**
1. Aggiungere funzione `downsampleData`
2. Nel `useMemo` di `chartData`, applicare il downsampling **dopo** l'ordinamento, preservando il punto `isCurrent`
3. Ridurre i dot: mostrare dot solo su primo, ultimo e `isCurrent`; gli altri punti intermedi senza dot (restituire `<circle r={0} />`)

**File 2: `src/components/dashboard/charts/PerformanceEvolutionChart.tsx`**
1. Stessa funzione `downsampleData` 
2. Applicare al `chartData` nel `useMemo` prima del return
3. Dot della linea principale: funzione che mostra dot solo su primo/ultimo, nasconde gli intermedi
4. Dot della linea benchmark: stessa logica

**Parametri:** `maxPoints = 30` — abbastanza punti per una curva morbida, pochi abbastanza per evitare l'effetto erratico.

