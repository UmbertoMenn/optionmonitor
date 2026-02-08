
# Piano: Inibizione Avvisi e Aggregazione Intelligente Dati Storici nella Vista Aggregata

## Panoramica

Questo piano affronta due esigenze per la vista "Aggregato - Tutti gli Utenti":

1. **Disabilitare la sezione avvisi e notifiche**: evita duplicazioni poiché gli avvisi vengono già generati/trasmessi per ogni singolo portfolio
2. **Aggregare intelligentemente i dati storici**: combina snapshot con date diverse da portfolio multipli per calcolare rendimenti significativi

---

## Parte 1: Inibizione Avvisi nella Vista Aggregata

### Problema
Nella pagina Derivatives, la card "Avvisi recenti (24 h)" e il dialog "Gestione Avvisi" sono attivi anche in vista aggregata. Questo non ha senso perché:
- Gli avvisi vengono già generati per ogni singolo portfolio
- L'admin riceve già una copia di tutti gli avvisi tramite notifiche
- Non esiste un portfolio_id "aggregato" valido per filtrare gli avvisi

### Soluzione

Modificare il componente `RecentAlertsCard` in `DerivativesSummaryCard.tsx` per mostrare un messaggio informativo quando `isAggregatedView = true`, nascondendo anche il pulsante di accesso al dialog Gestione Avvisi.

### File da modificare

**`src/components/derivatives/DerivativesSummaryCard.tsx`** (righe 614-768)

Aggiungere il check `isAggregatedView` dal context e renderizzare un placeholder informativo:

```typescript
function RecentAlertsCard({ categories, underlyingPrices }: RecentAlertsCardProps) {
  const { selectedPortfolio, isAggregatedView } = usePortfolioContext();
  const portfolioId = selectedPortfolio?.id;
  
  // Se in vista aggregata, mostra messaggio informativo invece degli avvisi
  if (isAggregatedView) {
    return (
      <Card className="border-border bg-card">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-muted-foreground" />
            <CardTitle className="text-xl font-bold tracking-tight text-muted-foreground">
              Avvisi recenti (24 h)
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-col items-center justify-center min-h-[200px] text-center">
            <Info className="w-8 h-8 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              Gli avvisi sono disponibili per i singoli portfolio.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Seleziona un portfolio specifico per visualizzare e gestire gli avvisi.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // ... resto del codice esistente per portfolio singolo
}
```

---

## Parte 2: Aggregazione Intelligente Dati Storici

### Problema Attuale

L'aggregazione attuale in `useHistoricalData.ts` (funzione `aggregateHistoricalByDate`) somma semplicemente i valori per data identica:

```typescript
// Logica attuale - problema
data.forEach(entry => {
  const existing = byDate.get(entry.snapshot_date);
  if (existing) {
    byDate.set(entry.snapshot_date, {
      ...existing,
      total_value: existing.total_value + entry.total_value,
      // ...
    });
  } else {
    byDate.set(entry.snapshot_date, { ...entry });
  }
});
```

Questo approccio fallisce quando i portfolio hanno snapshot in date diverse:
- Se Portfolio A ha snapshot il 01/01 e Portfolio B ha snapshot il 15/01, il punto 01/01 mostra solo il valore di A
- I calcoli P/L e giacenza media risultano imprecisi

### Strategia di Aggregazione: Interpolazione Lineare

Per ogni data unica presente nei dati storici:
1. Per ogni portfolio, trova il valore a quella data:
   - Se esiste uno snapshot esatto → usa quel valore
   - Altrimenti → interpola linearmente tra lo snapshot precedente e successivo
2. Somma i valori interpolati di tutti i portfolio

Questo garantisce che ogni punto del grafico rappresenti il patrimonio totale stimato a quella data.

### Modifiche Richieste

#### 2.1 Aggiornare `useHistoricalData.ts`

Sostituire la funzione `aggregateHistoricalByDate` con una nuova logica `aggregateHistoricalWithInterpolation`:

```typescript
// Helper: interpola il valore tra due snapshot
function interpolateValue(
  targetDate: Date,
  before: HistoricalDataEntry | null,
  after: HistoricalDataEntry | null
): Partial<HistoricalDataEntry> | null {
  if (!before && !after) return null;
  if (!before) return after;
  if (!after) return before;
  
  const beforeDate = new Date(before.snapshot_date).getTime();
  const afterDate = new Date(after.snapshot_date).getTime();
  const targetTime = targetDate.getTime();
  
  if (afterDate === beforeDate) return before;
  
  const ratio = (targetTime - beforeDate) / (afterDate - beforeDate);
  
  return {
    total_value: before.total_value + (after.total_value - before.total_value) * ratio,
    netting_total: before.netting_total + (after.netting_total - before.netting_total) * ratio,
    netting_ex_cc: before.netting_ex_cc + (after.netting_ex_cc - before.netting_ex_cc) * ratio,
    netting_ex_cc_np: (before.netting_ex_cc_np ?? before.netting_ex_cc) + 
      ((after.netting_ex_cc_np ?? after.netting_ex_cc) - (before.netting_ex_cc_np ?? before.netting_ex_cc)) * ratio,
    equity_exposure_pct: before.equity_exposure_pct, // Usa l'ultimo noto
    usd_exposure_pct: before.usd_exposure_pct,
  };
}

function aggregateHistoricalWithInterpolation(data: HistoricalDataEntry[]): HistoricalDataEntry[] {
  if (data.length === 0) return [];
  
  // Raggruppa per portfolio_id
  const byPortfolio = new Map<string, HistoricalDataEntry[]>();
  data.forEach(entry => {
    const list = byPortfolio.get(entry.portfolio_id) || [];
    list.push(entry);
    byPortfolio.set(entry.portfolio_id, list);
  });
  
  // Ordina ogni portfolio per data
  byPortfolio.forEach((entries, key) => {
    entries.sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
    byPortfolio.set(key, entries);
  });
  
  // Raccogli tutte le date uniche
  const allDates = new Set<string>();
  data.forEach(entry => allDates.add(entry.snapshot_date));
  const sortedDates = Array.from(allDates).sort();
  
  // Per ogni data, calcola il valore aggregato con interpolazione
  const aggregated: HistoricalDataEntry[] = sortedDates.map(dateStr => {
    const targetDate = new Date(dateStr);
    let totalValue = 0;
    let nettingTotal = 0;
    let nettingExCC = 0;
    let nettingExCCNP = 0;
    let sumEquityPct = 0;
    let sumUsdPct = 0;
    let totalWeight = 0;
    
    byPortfolio.forEach((entries) => {
      const exact = entries.find(e => e.snapshot_date === dateStr);
      
      if (exact) {
        totalValue += exact.total_value;
        nettingTotal += exact.netting_total;
        nettingExCC += exact.netting_ex_cc;
        nettingExCCNP += exact.netting_ex_cc_np ?? exact.netting_ex_cc;
        sumEquityPct += exact.equity_exposure_pct * exact.total_value;
        sumUsdPct += exact.usd_exposure_pct * exact.total_value;
        totalWeight += exact.total_value;
      } else {
        // Trova before e after per interpolazione
        let before: HistoricalDataEntry | null = null;
        let after: HistoricalDataEntry | null = null;
        
        for (const e of entries) {
          if (e.snapshot_date < dateStr) before = e;
          else if (e.snapshot_date > dateStr && !after) { after = e; break; }
        }
        
        // Interpola solo se la data è tra il primo e l'ultimo snapshot del portfolio
        if (before && after) {
          const interpolated = interpolateValue(targetDate, before, after);
          if (interpolated) {
            totalValue += interpolated.total_value || 0;
            nettingTotal += interpolated.netting_total || 0;
            nettingExCC += interpolated.netting_ex_cc || 0;
            nettingExCCNP += interpolated.netting_ex_cc_np || 0;
            sumEquityPct += (before.equity_exposure_pct || 0) * (interpolated.total_value || 0);
            sumUsdPct += (before.usd_exposure_pct || 0) * (interpolated.total_value || 0);
            totalWeight += interpolated.total_value || 0;
          }
        } else if (before && !after) {
          // Carry forward: usa l'ultimo valore noto
          totalValue += before.total_value;
          nettingTotal += before.netting_total;
          nettingExCC += before.netting_ex_cc;
          nettingExCCNP += before.netting_ex_cc_np ?? before.netting_ex_cc;
          sumEquityPct += before.equity_exposure_pct * before.total_value;
          sumUsdPct += before.usd_exposure_pct * before.total_value;
          totalWeight += before.total_value;
        }
        // Se !before, il portfolio non esisteva ancora: non contribuisce
      }
    });
    
    // Medie ponderate per equity/usd exposure
    const avgEquityPct = totalWeight > 0 ? sumEquityPct / totalWeight : 0.6;
    const avgUsdPct = totalWeight > 0 ? sumUsdPct / totalWeight : 0.8;
    
    return {
      id: `aggregated-${dateStr}`,
      portfolio_id: 'AGGREGATED',
      snapshot_date: dateStr,
      total_value: totalValue,
      netting_total: nettingTotal,
      netting_ex_cc: nettingExCC,
      netting_ex_cc_np: nettingExCCNP,
      deposits: 0, // Sarà calcolato da useDeposits
      average_balance: 0,
      equity_exposure_pct: avgEquityPct,
      usd_exposure_pct: avgUsdPct,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });
  
  return aggregated.sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date));
}
```

Nella query, sostituire la chiamata:
```typescript
return aggregateHistoricalWithInterpolation(data as unknown as HistoricalDataEntry[]);
```

#### 2.2 Depositi (già OK)

I depositi sono già aggregati correttamente in `useDeposits.ts`:
- Vista aggregata: fetch tutti i depositi senza filtro portfolio_id
- Non serve interpolazione per i depositi perché sono eventi discreti

#### 2.3 Grafici dei Rendimenti (già OK)

I grafici `PerformanceEvolutionChart` e `YearlyReturnChart` ricevono già `historicalData` e `deposits` come props:
- Con l'aggregazione migliorata, i dati storici saranno già coerenti
- I depositi vengono già sommati globalmente
- I calcoli P/L funzioneranno correttamente sulla serie interpolata

---

## Parte 3: Disabilitare Funzionalità di Modifica in Vista Aggregata

### Dashboard

In vista aggregata non ha senso:
- Salvare snapshot (non esiste un portfolio "aggregato" reale)
- Modificare manualmente la giacenza media
- Caricare file Excel o pulire dati

**Modifiche in `src/components/dashboard/Dashboard.tsx`**:

1. Importare `isAggregatedView` dal context
2. Nascondere il pulsante "Salva Snapshot"
3. Nascondere la sezione "Gestione Dati" (HistoricalDataForm, DepositsSection)
4. Nascondere FileUploader e pulsante "Pulisci Dati Portfolio"

```typescript
const { isAggregatedView } = usePortfolioContext();

// Nel JSX:
{!isAggregatedView && (
  <Button onClick={...}>
    <Save className="w-4 h-4 mr-2" />
    Salva Snapshot
  </Button>
)}

// Sezione Gestione Dati
{!isAggregatedView && (
  <div className="space-y-3">
    <h3>Gestione Dati</h3>
    <HistoricalDataForm ... />
    <DepositsSection ... />
  </div>
)}

// FileUploader e Clear button
{!isAggregatedView && (
  <div className="space-y-3">
    <h3>Carica Portfolio</h3>
    <FileUploader />
    <Button>Pulisci Dati Portfolio</Button>
  </div>
)}
```

**Modifiche in `src/components/dashboard/StatsCards.tsx`**:

Disabilitare l'editing della giacenza media in vista aggregata:

```typescript
import { usePortfolioContext } from '@/contexts/PortfolioContext';

// Nel componente:
const { isAggregatedView } = usePortfolioContext();

// Nel rendering della card "Giacenza Media":
{
  key: 'giacenza-media',
  label: 'Giacenza Media',
  value: averageBalance > 0 ? formatCurrency(averageBalance) : '—',
  icon: Wallet,
  isEditable: !isAggregatedView, // Disabilita editing in aggregato
  ...
}
```

---

## Riepilogo File da Modificare

| File | Modifiche |
|------|-----------|
| `src/hooks/useHistoricalData.ts` | Nuova funzione `aggregateHistoricalWithInterpolation` con interpolazione lineare |
| `src/components/derivatives/DerivativesSummaryCard.tsx` | Check `isAggregatedView` in `RecentAlertsCard`, messaggio informativo, nascondi settings |
| `src/components/dashboard/Dashboard.tsx` | Nascondere sezioni di modifica (Salva Snapshot, Gestione Dati, FileUploader, Clear) |
| `src/components/dashboard/StatsCards.tsx` | Disabilitare editing giacenza media con `isAggregatedView` |

---

## Comportamento Atteso

### Vista Aggregata
1. **Avvisi**: Card informativa che indica di selezionare un portfolio singolo
2. **Grafici storici**: Serie temporale con valori interpolati per tutte le date
3. **StatsCards**: P/L e giacenza media calcolati sui dati aggregati, editing disabilitato
4. **Gestione dati**: Sezione nascosta (read-only)

### Vista Portfolio Singolo
Comportamento invariato - tutte le funzionalità attive.

---

## Note Tecniche

1. **Performance**: L'algoritmo di interpolazione e' O(date x portfolio), efficiente per dataset tipici
2. **Accuracy**: L'interpolazione lineare e' una stima ragionevole per patrimoni che variano gradualmente
3. **Edge cases gestiti**:
   - Portfolio nuovo (senza dati prima di una data): non contribuisce fino al primo snapshot
   - Portfolio chiuso (senza dati dopo una data): usa l'ultimo valore noto (carry forward)
   - Esposizioni equity/USD: medie ponderate per valore del portfolio

