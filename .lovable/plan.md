
# Piano: Aggiornamento Etichette Netting e Salvataggio Netting ex CC e NP OTM

## Obiettivo
1. Rinominare le etichette "Netting ex CC" in "Netting ex. Covered Call"
2. Rinominare le etichette "Netting ex CC e NP OTM" in "Netting ex. Covered Call e Naked Put OTM"
3. Aggiungere il campo `netting_ex_cc_np` ai dati storici con supporto completo per snapshot, form e calcolo P/L

---

## Parte 1: Aggiornamento Etichette

### File da modificare:

**1. `src/components/dashboard/ViewModeSelector.tsx`**
- Linea 13: `'Netting ex CC'` → `'Netting ex. Covered Call'`
- Linea 14: `'Netting ex CC e NP OTM'` → `'Netting ex. Covered Call e Naked Put OTM'`

**2. `src/components/dashboard/StatsCards.tsx`**
- Linea 90: Labels per `netting_ex_cc` → `'Netting ex. Covered Call'`
- Linea 91: Labels per `netting_ex_cc_np` → `'Netting ex. Covered Call e NP'`

**3. `src/components/dashboard/DynamicPortfolioChart.tsx`**
- Linea 78: Titolo chart `'Netting ex. Covered Call'`
- Linea 79: Titolo chart `'Netting ex. Covered Call e Naked Put OTM'`
- Linea 123: Label barra `'Netting ex. Covered Call e NP OTM'`
- Linea 138: Label barra `'Netting ex. Covered Call'`

**4. `src/components/dashboard/HistoricalDataForm.tsx`**
- Linea 168, 209, 284: Labels form → `'Netting ex. Covered Call ($)'`

---

## Parte 2: Aggiunta Campo `netting_ex_cc_np` ai Dati Storici

### 2.1 Migrazione Database
Aggiungere nuova colonna alla tabella `historical_data`:

```sql
ALTER TABLE public.historical_data 
ADD COLUMN IF NOT EXISTS netting_ex_cc_np numeric DEFAULT 0 NOT NULL;
```

### 2.2 Aggiornamento Tipi TypeScript

**File: `src/types/historicalData.ts`**
```typescript
export interface HistoricalDataEntry {
  id: string;
  portfolio_id: string;
  snapshot_date: string;
  total_value: number;
  netting_total: number;
  netting_ex_cc: number;
  netting_ex_cc_np: number;  // NUOVO
  deposits: number;
  average_balance: number;
  created_at: string;
  updated_at: string;
}

export interface HistoricalDataInput {
  snapshot_date: string;
  total_value: number;
  netting_total: number;
  netting_ex_cc: number;
  netting_ex_cc_np: number;  // NUOVO
  deposits: number;
  average_balance: number;
}
```

### 2.3 Aggiornamento Hook `useHistoricalData.ts`

Aggiungere `netting_ex_cc_np` nell'upsert:
```typescript
const { data, error } = await supabase
  .from('historical_data')
  .upsert({
    portfolio_id: portfolioId,
    snapshot_date: entry.snapshot_date,
    total_value: entry.total_value,
    netting_total: entry.netting_total,
    netting_ex_cc: entry.netting_ex_cc,
    netting_ex_cc_np: entry.netting_ex_cc_np,  // NUOVO
    deposits: entry.deposits,
    average_balance: entry.average_balance,
  }, { ... })
```

### 2.4 Aggiornamento Dashboard (Salva Snapshot)

**File: `src/components/dashboard/Dashboard.tsx`**
Aggiungere `netting_ex_cc_np` al salvataggio snapshot:
```typescript
upsertHistoricalData({
  snapshot_date: portfolio.snapshot_date,
  total_value: summary?.totalValue ?? 0,
  netting_total: netting.nettingTotal,
  netting_ex_cc: netting.nettingExCoveredCall,
  netting_ex_cc_np: netting.nettingExCCAndNP,  // NUOVO
  deposits: 0,
  average_balance: 0,
});
```

Passare `currentNettingExCCAndNP` al form:
```typescript
<HistoricalDataForm
  ...
  currentNettingExCC={netting.nettingExCoveredCall}
  currentNettingExCCAndNP={netting.nettingExCCAndNP}  // NUOVO
/>
```

### 2.5 Aggiornamento HistoricalDataForm

**File: `src/components/dashboard/HistoricalDataForm.tsx`**

1. Aggiungere prop `currentNettingExCCAndNP`
2. Aggiungere stato form `formNettingExCCNP`
3. Aggiungere campo input nel form (sia edit che create)
4. Includere nel `handleSave`
5. Visualizzare nei dati salvati
6. Aggiornare `useCurrent()` per usare il nuovo valore

Layout form aggiornato (griglia 2 colonne, 2 righe per i netting):
```
| Netting Totale         | Netting ex. Covered Call    |
| Netting ex. CC e NP    |                              |
```

### 2.6 Aggiornamento Calcolo P/L in StatsCards

**File: `src/components/dashboard/StatsCards.tsx`**

Nel `calculatePL`, usare il valore storico corretto per `netting_ex_cc_np`:
```typescript
case 'netting_ex_cc_np':
  currentValue = nettingExCCAndNP;
  historicalValue = historical.netting_ex_cc_np ?? historical.netting_ex_cc;
  break;
```

Nel calcolo `timeWeightedData`, includere il nuovo viewMode:
```typescript
case 'netting_ex_cc_np':
  historicalValue = selectedHistoricalEntry.netting_ex_cc_np ?? selectedHistoricalEntry.netting_ex_cc;
  break;
```

Aggiornare anche la card "Patrimonio Iniziale" per mostrare il valore corretto:
```typescript
viewMode === 'netting_ex_cc_np'
  ? selectedHistoricalEntry!.netting_ex_cc_np ?? selectedHistoricalEntry!.netting_ex_cc
  : ...
```

---

## Riepilogo File Modificati

| File | Modifiche |
|------|-----------|
| **Migrazione SQL** | Nuova colonna `netting_ex_cc_np` |
| `src/types/historicalData.ts` | Aggiunta campo ai tipi |
| `src/hooks/useHistoricalData.ts` | Supporto upsert nuovo campo |
| `src/components/dashboard/ViewModeSelector.tsx` | Etichette estese |
| `src/components/dashboard/StatsCards.tsx` | Etichette + P/L con nuovo campo |
| `src/components/dashboard/DynamicPortfolioChart.tsx` | Etichette chart |
| `src/components/dashboard/HistoricalDataForm.tsx` | Etichette + nuovo campo form |
| `src/components/dashboard/Dashboard.tsx` | Snapshot + prop nuovo campo |

---

## Dettagli Tecnici

- **Compatibilità retroattiva**: Il fallback a `netting_ex_cc` quando `netting_ex_cc_np` è null garantisce che i dati storici esistenti continuino a funzionare
- **Migrazione non distruttiva**: La colonna viene aggiunta con default 0, i record esistenti rimangono validi
- **Nessuna nuova dipendenza richiesta**
