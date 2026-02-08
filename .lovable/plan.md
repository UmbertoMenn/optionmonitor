
# Piano: Correzione Calcoli Vista Aggregata (Giacenza Media, P/L e Grafici)

## Problema Identificato

Nella vista aggregata ("Aggregato - Tutti gli Utenti"), tre elementi non funzionano correttamente:

1. **Giacenza Media = 0**: Il calcolo dipende da `portfolio.snapshot_date`, che e' `null` per il portfolio aggregato
2. **Grafici vuoti/incompleti**: I grafici ricevono `currentDate = null`, impedendo l'aggiunta del punto corrente
3. **P/L non calcolabile**: Senza giacenza media, il calcolo del rendimento percentuale fallisce

La causa radice e' che il portfolio aggregato viene costruito con `snapshot_date: null` perche' non esiste una singola data per tutti i portfolio.

---

## Soluzione Proposta

### Strategia: Calcolare una `snapshot_date` Aggregata

Usare la **data piu' recente** tra tutti i portfolio come `snapshot_date` per la vista aggregata. Questa data rappresenta il punto temporale piu' aggiornato dell'aggregazione.

---

## Parte 1: Aggiornare `usePortfolio.ts`

Modificare la costruzione del portfolio aggregato per calcolare dinamicamente la `snapshot_date` come la data piu' recente tra tutti i portfolio.

### Modifiche Richieste

**File**: `src/hooks/usePortfolio.ts`

1. Fetch tutti i portfolio quando in vista aggregata (per ottenere le loro `snapshot_date`)
2. Calcolare la `snapshot_date` aggregata come `max(snapshot_date)` di tutti i portfolio
3. Calcolare anche `cash_value` e `total_value` aggregati

```typescript
// Nuovo query per ottenere tutti i portfolio (solo quando aggregato)
const allPortfoliosQuery = useQuery({
  queryKey: ['all-portfolios-for-aggregation'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('portfolios')
      .select('id, snapshot_date, cash_value, total_value');
    if (error) throw error;
    return data;
  },
  enabled: isAggregatedView && isAdmin,
});

// Calcolare snapshot_date aggregata
const aggregatedSnapshotDate = useMemo(() => {
  const portfolios = allPortfoliosQuery.data || [];
  const validDates = portfolios
    .map(p => p.snapshot_date)
    .filter((d): d is string => !!d);
  if (validDates.length === 0) return null;
  return validDates.sort().reverse()[0]; // Data piu' recente
}, [allPortfoliosQuery.data]);

// Calcolare cash_value aggregato
const aggregatedCashValue = useMemo(() => {
  const portfolios = allPortfoliosQuery.data || [];
  return portfolios.reduce((sum, p) => sum + (p.cash_value || 0), 0);
}, [allPortfoliosQuery.data]);

// Costruire il portfolio aggregato con dati reali
const aggregatedPortfolio: Portfolio | null = isAggregatedView ? {
  id: AGGREGATED_PORTFOLIO_ID,
  user_id: 'aggregated',
  name: 'Aggregato - Tutti gli Utenti',
  total_value: 0, // Calcolato dal summary
  cash_value: aggregatedCashValue,
  initial_value: null,
  initial_date: null,
  deposits: null,
  average_balance: null,
  average_balance_date: null,
  snapshot_date: aggregatedSnapshotDate, // <-- DATA AGGREGATA
  last_updated: new Date().toISOString(),
  created_at: new Date().toISOString(),
} : null;
```

---

## Parte 2: Aggiornare `StatsCards.tsx` per Vista Aggregata

Il componente `StatsCards` usa `portfolio.snapshot_date` per calcolare la giacenza media. Con la modifica precedente, ora ricevera' una data valida.

### Verifica

Nessuna modifica necessaria al componente stesso - ricevera' automaticamente la `snapshot_date` corretta dal portfolio aggregato.

### Test

Verificare che:
- La giacenza media venga calcolata correttamente usando i depositi aggregati
- Il P/L venga calcolato usando la giacenza media ponderata

---

## Parte 3: Grafici (Verifica)

I grafici ricevono `currentDate={portfolio?.snapshot_date}`. Con la modifica a `usePortfolio.ts`:

- `PerformanceEvolutionChart`: Ricevera' la data corretta, potra' calcolare i rendimenti
- `PortfolioEvolutionChart`: Ricevera' la data corretta per il punto finale
- `YearlyReturnChart`: Funzionera' correttamente con i dati storici interpolati

### Test

Verificare che:
- Il punto corrente venga aggiunto ai grafici quando appropriato
- I rendimenti vengano calcolati correttamente sulla serie storica interpolata

---

## Parte 4: Ottimizzazione Aggregazione Depositi

I depositi sono gia' aggregati correttamente in `useDeposits.ts` (fetch tutti senza filtro portfolio_id). 

La giacenza media sara' calcolata usando:
- **Data iniziale**: dalla selezione storica nel dropdown
- **Data finale**: `aggregatedSnapshotDate` (data piu' recente dei portfolio)
- **Depositi**: tutti i depositi nel periodo

---

## Riepilogo Modifiche

| File | Modifica |
|------|----------|
| `src/hooks/usePortfolio.ts` | Aggiungere query per tutti i portfolio, calcolare `aggregatedSnapshotDate` e `aggregatedCashValue`, usarli nel portfolio aggregato |

---

## Comportamento Atteso Dopo le Modifiche

### Vista Aggregata
1. **Grafici**: Mostrano correttamente l'evoluzione del rendimento e del patrimonio con dati interpolati
2. **Giacenza Media**: Calcolata usando la data piu' recente tra tutti i portfolio come endpoint
3. **P/L**: Calcolato correttamente = (Valore Attuale - Valore Storico - Depositi Netti)
4. **Rendimento %**: Calcolato = P/L / Giacenza Media

### Vista Portfolio Singolo
Comportamento invariato.

---

## Note Tecniche

1. **Performance**: La query aggiuntiva e' leggera (solo 3 colonne, pochi record)
2. **Edge case**: Se nessun portfolio ha `snapshot_date`, la data rimane null (comportamento attuale)
3. **Consistenza**: La data aggregata e' sempre quella del portfolio piu' recente, garantendo che i grafici mostrino il punto piu' aggiornato
