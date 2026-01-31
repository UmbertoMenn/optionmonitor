
# Piano: Semplificazione Dati Storici e Nuovo Calcolo Rendimenti

## Obiettivo
Semplificare il form dei dati storici rimuovendo versamenti e giacenza media, e spostare questi input nel selettore P/L con calcolo automatico intelligente della giacenza media.

---

## Modifiche da Implementare

### 1. Semplificare HistoricalDataForm

Rimuovere dal form i campi:
- Versamenti (`deposits`)
- Giacenza Media (`average_balance`)

Il form salverà solo:
- Data
- Patrimonio Totale
- Netting Totale
- Netting ex CC

I campi `deposits` e `average_balance` nel database rimarranno con default 0.

### 2. Aggiornare Visualizzazione Dati Salvati

Nella lista dei dati storici salvati, mostrare solo:
- Data
- Patrimonio
- Netting Totale
- Netting ex CC

### 3. Aggiungere Input Versamenti e Giacenza Media in StatsCards

Nella card Profitto/Perdita, sotto il selettore data, aggiungere:
1. **Campo Versamenti**: input numerico per inserire i versamenti dal periodo storico ad oggi
2. **Campo Giacenza Media**: 
   - Calcolato automaticamente secondo la logica:
     - Se versamenti = 0: Giacenza Media = Valore storico (base/netting_total/netting_ex_cc a seconda del viewMode)
     - Se versamenti > 0: Giacenza Media = Valore storico + (versamenti / 2)
   - Possibilità di override manuale

### 4. Nuovo Calcolo P/L

```
P/L Assoluto = Valore Attuale - Valore Storico - Versamenti
Rendimento % = (Valore Attuale - Valore Storico - Versamenti) / Giacenza Media × 100
```

### 5. Gestione Stato in Dashboard

Aggiungere nuovi stati in Dashboard.tsx:
- `deposits`: number (versamenti inseriti dall'utente)
- `averageBalance`: number (giacenza media, calcolata o manuale)
- `isManualAverageBalance`: boolean (flag per indicare se l'utente ha modificato manualmente)

---

## Dettagli Tecnici

### Modifiche ai File

| File | Modifiche |
|------|-----------|
| `src/components/dashboard/HistoricalDataForm.tsx` | Rimuovere campi versamenti e giacenza media dal form e dalla visualizzazione |
| `src/components/dashboard/StatsCards.tsx` | Aggiungere input versamenti e giacenza media nella card P/L, implementare nuova logica calcolo |
| `src/components/dashboard/Dashboard.tsx` | Aggiungere stati `deposits`, `averageBalance`, `isManualAverageBalance` e passarli a StatsCards |

### Nuova Interfaccia StatsCards

```typescript
interface StatsCardsProps {
  // ... props esistenti
  deposits: number;
  averageBalance: number;
  isManualAverageBalance: boolean;
  onDepositsChange: (value: number) => void;
  onAverageBalanceChange: (value: number) => void;
  onManualAverageBalanceToggle: (isManual: boolean) => void;
}
```

### Logica Calcolo Giacenza Media (in StatsCards)

```typescript
// Calcolo automatico giacenza media quando cambia data storica o versamenti
useEffect(() => {
  if (isManualAverageBalance) return; // Non ricalcolare se manuale
  
  if (!selectedHistoricalEntry) {
    onAverageBalanceChange(0);
    return;
  }
  
  // Prendi il valore storico in base al viewMode
  let historicalValue: number;
  switch (viewMode) {
    case 'netting_total': historicalValue = selectedHistoricalEntry.netting_total; break;
    case 'netting_ex_cc': historicalValue = selectedHistoricalEntry.netting_ex_cc; break;
    default: historicalValue = selectedHistoricalEntry.total_value;
  }
  
  // Calcola giacenza media
  const calculatedAverage = deposits > 0 
    ? historicalValue + (deposits / 2) 
    : historicalValue;
  
  onAverageBalanceChange(calculatedAverage);
}, [selectedHistoricalEntry, deposits, viewMode, isManualAverageBalance]);
```

### Nuovo Calcolo P/L

```typescript
const calculatePL = () => {
  if (!selectedHistoricalEntry) return { absolute: 0, percent: 0 };
  
  const historical = selectedHistoricalEntry;
  let currentValue: number;
  let historicalValue: number;

  switch (viewMode) {
    case 'netting_total':
      currentValue = nettingTotal;
      historicalValue = historical.netting_total;
      break;
    case 'netting_ex_cc':
      currentValue = nettingExCC;
      historicalValue = historical.netting_ex_cc;
      break;
    default:
      currentValue = summary.totalValue;
      historicalValue = historical.total_value;
  }

  // P/L = Valore Attuale - Valore Storico - Versamenti
  const absolutePL = currentValue - historicalValue - deposits;
  
  // Rendimento % = P/L / Giacenza Media
  const percentPL = averageBalance > 0 ? (absolutePL / averageBalance) * 100 : 0;
  
  return { absolute: absolutePL, percent: percentPL };
};
```

### UI nella Card P/L

```text
┌─────────────────────────────────────┐
│ Profitto/Perdita                    │
│ +$12,500 (+8.5%)                    │
│                                     │
│ [📅 Data storica ▼]                │
│                                     │
│ Versamenti: [________] $            │
│                                     │
│ Giacenza Media: [________] $        │
│ □ Calcola automaticamente           │
└─────────────────────────────────────┘
```

---

## Flusso Utente

1. L'utente seleziona una data storica dal dropdown
2. Il sistema mostra gli input per Versamenti e Giacenza Media
3. Se l'utente inserisce dei versamenti, la giacenza media si aggiorna automaticamente
4. L'utente può modificare manualmente la giacenza media spuntando/deselezionando il checkbox
5. Il P/L viene calcolato con la formula corretta

---

## Note Database

I campi `deposits` e `average_balance` nella tabella `historical_data` rimarranno con default 0 ma non verranno più utilizzati attivamente. Non è necessaria una migrazione poiché i valori esistenti non impattano la nuova logica.
