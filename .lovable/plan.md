

## Selezione date a due livelli: Mese → Data

### Problema
Anche raggruppando per anno, con molte date lo scroll resta infinito. Serve una navigazione a due step.

### Soluzione
Sostituire il singolo Select con **due Select affiancati**:

1. **Select Mese/Anno** — mostra i mesi disponibili in formato `MMM yyyy` (es. "Mar 2026", "Feb 2026"), ordinati dal più recente
2. **Select Data** — mostra solo le date del mese selezionato, in formato `dd/MM/yyyy` (es. "01/03/2026")

Quando si seleziona un mese, il secondo Select si popola con le date di quel mese. Il valore "Nessuna data" resta come opzione di reset.

### File da modificare

**1. `src/components/dashboard/StatsCards.tsx` (righe 405-438)**
- Estrarre i mesi disponibili da `historicalData` come `Set<string>` (chiave `yyyy-MM`)
- Aggiungere stato locale `selectedMonth` (default: mese della data selezionata corrente, o il più recente)
- Primo Select: mesi disponibili, formato `MMM yyyy`
- Secondo Select: date filtrate per mese selezionato, formato `dd/MM/yyyy`
- Layout: due select in riga (`grid grid-cols-2 gap-1`)

**2. `src/components/dashboard/HistoricalDataForm.tsx` (lista snapshot)**
- Stesso raggruppamento per mese con intestazioni `MMM yyyy`
- Date mostrate come `dd/MM/yyyy` complete

### Risultato visivo (Card PL)
```
[Mar 2026 ▼] [01/03/2026 ▼]
```
Selezionando un mese diverso, il secondo dropdown mostra solo le date di quel mese. Nessuno scroll infinito.

