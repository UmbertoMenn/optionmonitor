
# Piano: Toggle Currency Default ON + Selettore Intervallo Temporale

## Panoramica

Modifiche al grafico "Evoluzione Rendimento" nella Dashboard:
1. Attivare il toggle Currency di default
2. Aggiungere un selettore per l'intervallo temporale (1A, 2A, 3A, MAX)

---

## 1. Toggle Currency Attivo di Default

### Modifica

**File**: `src/components/dashboard/charts/PerformanceEvolutionChart.tsx`

Cambiare l'inizializzazione dello stato:

```tsx
// Prima (linea 215)
const [currencyAdjusted, setCurrencyAdjusted] = useState(false);

// Dopo
const [currencyAdjusted, setCurrencyAdjusted] = useState(true);
```

---

## 2. Selettore Intervallo Temporale

### Opzioni disponibili

| Opzione | Descrizione | Comportamento |
|---------|-------------|---------------|
| 1A | Ultimo anno | Filtra dati degli ultimi 12 mesi |
| 2A | Ultimi 2 anni | Filtra dati degli ultimi 24 mesi |
| 3A | Ultimi 3 anni | Filtra dati degli ultimi 36 mesi |
| MAX | Tutto | Mostra tutti i dati disponibili |

### Logica chiave

Quando si cambia l'intervallo temporale:
- I dati vengono filtrati per mostrare solo quelli nell'intervallo selezionato
- Il rendimento % viene ricalcolato **partendo da 0** dal primo punto dell'intervallo filtrato
- Il primo dato dell'intervallo diventa il nuovo "punto iniziale" per il calcolo del rendimento

### Implementazione

**File**: `src/components/dashboard/charts/PerformanceEvolutionChart.tsx`

1. Aggiungere stato per l'intervallo temporale:
```tsx
type TimeRange = '1Y' | '2Y' | '3Y' | 'MAX';
const [timeRange, setTimeRange] = useState<TimeRange>('MAX');
```

2. Aggiungere funzione per filtrare i dati:
```tsx
const filteredHistoricalData = useMemo(() => {
  if (timeRange === 'MAX') return historicalData;
  
  const now = new Date();
  const years = timeRange === '1Y' ? 1 : timeRange === '2Y' ? 2 : 3;
  const cutoffDate = new Date(now.setFullYear(now.getFullYear() - years));
  
  return historicalData.filter(entry => 
    new Date(entry.snapshot_date) >= cutoffDate
  );
}, [historicalData, timeRange]);
```

3. Usare `filteredHistoricalData` invece di `historicalData` nel calcolo di `chartData`, ricalcolando il rendimento dal primo punto filtrato

4. Aggiungere UI per il selettore nella legenda (accanto al toggle Currency):
```tsx
<div className="flex items-center gap-1 border rounded-md">
  {(['1Y', '2Y', '3Y', 'MAX'] as const).map((range) => (
    <button
      key={range}
      onClick={() => setTimeRange(range)}
      className={cn(
        "px-2 py-0.5 text-xs transition-colors",
        timeRange === range 
          ? "bg-primary text-primary-foreground" 
          : "hover:bg-muted"
      )}
    >
      {range === 'MAX' ? 'MAX' : range.replace('Y', 'A')}
    </button>
  ))}
</div>
```

---

## Layout UI Proposto

```text
┌─────────────────────────────────────────────────────────────────┐
│ [Portafoglio ─] [Benchmark ⓘ] [Aggiorna]     [1A|2A|3A|MAX] Currency [○] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                        GRAFICO                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

Il selettore dell'intervallo sarà posizionato a destra, prima del toggle Currency.

---

## File Coinvolti

| File | Modifiche |
|------|-----------|
| `src/components/dashboard/charts/PerformanceEvolutionChart.tsx` | - Cambiare default `currencyAdjusted` a `true` |
| | - Aggiungere stato `timeRange` |
| | - Aggiungere filtro dati storici |
| | - Aggiungere UI selettore intervallo nella legenda |
| | - Passare `filteredHistoricalData` a `useBenchmarkData` |

---

## Note Tecniche

- Il ricalcolo del rendimento dal primo punto filtrato avviene automaticamente poiche il `chartData` usa sempre il primo elemento dell'array ordinato come riferimento iniziale
- Il benchmark viene anch'esso ricalcolato sullo stesso intervallo temporale
- I depositi vengono filtrati coerentemente per il periodo selezionato
- Lo stato `timeRange` e `currencyAdjusted` sono locali al componente (non persistenti)
