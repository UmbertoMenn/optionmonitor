

## Piano: YTD + normalizzazione curve

### 1. Aggiungere filtro YTD

**File: `src/components/dashboard/charts/PerformanceEvolutionChart.tsx`**

- **Tipo** (riga 33): `'1M' | '3M' | '6M' | '1Y' | '2Y' | '3Y' | 'MAX' | 'YTD'`
- **Bottoni** (riga 231): aggiungere `'YTD'` dopo `'MAX'` nell'array
- **Label**: YTD non necessita di sostituzione (non contiene "Y" + cifra), viene visualizzato così com'è
- **Filtro dati** (righe 327-334): aggiungere caso `case 'YTD': cutoffDate = new Date(now.getFullYear(), 0, 1); break;` — filtra dal 1° gennaio dell'anno corrente
- **Filtro depositi** (righe 379-386): stesso caso YTD

### 2. Normalizzare le curve (ridurre punti interattivi)

Il downsampling a 30 punti è già attivo, ma il problema è che il tooltip `activeDot` reagisce comunque a tutti i 30 punti. Per range brevi (1M, 3M) i dati originali possono essere pochi e la curva è già liscia, ma per range lunghi con molti snapshot la curva resta erratica perché 30 punti sono ancora troppi per periodi con alta volatilità giornaliera.

**Soluzione**: ridurre `maxPoints` dinamicamente in base al range:
- `1M`, `3M`: maxPoints = 20 (pochi dati, curva già liscia)
- `6M`, `1Y`: maxPoints = 25
- `2Y`, `3Y`, `MAX`, `YTD`: maxPoints = 30

Questo si implementa passando il `timeRange` alla logica di downsampling nel `useMemo` di `chartData` (riga 504).

### File modificato
Solo `src/components/dashboard/charts/PerformanceEvolutionChart.tsx`

