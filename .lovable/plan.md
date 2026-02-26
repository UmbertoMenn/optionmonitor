

## Piano: Aggiungere filtri temporali 1M, 3M, 6M

### Modifiche

**File: `src/components/dashboard/charts/PerformanceEvolutionChart.tsx`**

1. **Tipo TimeRange** (riga 33): estendere da `'1Y' | '2Y' | '3Y' | 'MAX'` a `'1M' | '3M' | '6M' | '1Y' | '2Y' | '3Y' | 'MAX'`

2. **Bottoni selettore** (riga 231): aggiungere `'1M', '3M', '6M'` all'array dei range

3. **Filtro dati storici** (righe 322-332): aggiornare la logica di calcolo `cutoffDate` per gestire mesi:
   ```typescript
   if (timeRange === 'MAX') return historicalData;
   const now = new Date();
   let cutoffDate: Date;
   switch (timeRange) {
     case '1M': cutoffDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()); break;
     case '3M': cutoffDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()); break;
     case '6M': cutoffDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()); break;
     case '1Y': cutoffDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()); break;
     case '2Y': cutoffDate = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate()); break;
     case '3Y': cutoffDate = new Date(now.getFullYear() - 3, now.getMonth(), now.getDate()); break;
   }
   ```

4. **Filtro depositi** (righe 366-374): stessa logica switch per il cutoff dei depositi

