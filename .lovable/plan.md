

# Piano: Giacenza Media Ponderata nel Tempo + Data Excel

## Panoramica

Implementare un calcolo della giacenza media **ponderato nel tempo**, dove ogni livello di saldo viene pesato per la durata in cui è rimasto invariato. Inoltre, estrarre automaticamente la data dal file Excel e mostrare i versamenti nel periodo sotto la card Giacenza Media.

## Formula Giacenza Media Ponderata

**Esempio dall'utente:**
- Valore iniziale: €100.000 (1 anno fa)
- Versamento: €100.000 (dopo 9 mesi)
- Periodo totale: 12 mesi

**Calcolo:**
```
Giacenza Media = 100.000 × (9/12) + 200.000 × (3/12)
               = 100.000 × 0,75 + 200.000 × 0,25
               = 75.000 + 50.000
               = €125.000
```

**Formula generale:**
```
Giacenza Media = Σ (Saldo_i × Giorni_i) / Giorni_totali
```

Dove ogni `Saldo_i` è il saldo in un periodo tra due eventi (inizio, versamento, o fine) e `Giorni_i` è la durata di quel periodo.

## Flusso Dati

```text
+------------------+     +-----------------+     +-------------------+
|   Excel Upload   | --> | Estrae data     | --> | Salva snapshot_date|
|   (FileUploader) |     | dall'header     |     | in portfolios      |
+------------------+     +-----------------+     +-------------------+
                                                          |
                                                          v
+------------------+     +-----------------+     +-------------------+
| Data Storica     | --> | Filtra deposits | --> | Lista versamenti  |
| selezionata      |     | nel periodo     |     | ordinata per data |
+------------------+     +-----------------+     +-------------------+
                                                          |
                                                          v
+------------------+                             +-------------------+
| Patrimonio Card  | <--------------------------- | Calcola pesi      |
| mostra data Excel|                             | temporali e       |
+------------------+                             | giacenza media    |
                                                 +-------------------+
                                                          |
                                                          v
                                                 +-------------------+
                                                 | Giacenza Media    |
                                                 | con versamenti    |
                                                 | sotto (non bold)  |
                                                 +-------------------+
```

## Modifiche Previste

### 1. Database: Colonna `snapshot_date`

Aggiungere colonna per salvare la data estratta dall'Excel.

**SQL Migration:**
```sql
ALTER TABLE portfolios ADD COLUMN snapshot_date DATE;
```

### 2. Parser Excel: Estrazione data

**File:** `src/lib/excelParser.ts`

Cercare nelle prime righe pattern come:
- "POSIZIONE AL DD/MM/YYYY"
- "DATA: DD/MM/YYYY"
- Numeri seriali Excel

### 3. FileUploader: Salvataggio data

**File:** `src/components/dashboard/FileUploader.tsx`

Salvare `snapshot_date` nel portfolio durante l'upload.

### 4. Dashboard: Passare deposits e portfolio

**File:** `src/components/dashboard/Dashboard.tsx`

Passare l'array completo `deposits` a StatsCards per il filtraggio.

### 5. StatsCards: Calcolo ponderato e UI

**File:** `src/components/dashboard/StatsCards.tsx`

#### Nuove Props

```typescript
interface StatsCardsProps {
  // ... esistenti ...
  allDeposits: DepositEntry[]; // Array completo versamenti
}
```

#### Algoritmo Giacenza Media Ponderata

```typescript
function calculateTimeWeightedAverage(
  startDate: Date,          // Data storica selezionata
  endDate: Date,            // Data Excel (snapshot_date)
  initialValue: number,     // Valore storico
  deposits: DepositEntry[]  // Versamenti nel periodo, ordinati per data
): number {
  // Giorni totali del periodo
  const totalDays = differenceInDays(endDate, startDate);
  if (totalDays <= 0) return initialValue;
  
  // Costruisci lista eventi (versamenti) nel periodo
  const depositsInPeriod = deposits
    .filter(d => {
      const date = new Date(d.deposit_date);
      return date > startDate && date <= endDate;
    })
    .sort((a, b) => 
      new Date(a.deposit_date).getTime() - new Date(b.deposit_date).getTime()
    );
  
  if (depositsInPeriod.length === 0) {
    // Nessun versamento: giacenza = valore iniziale
    return initialValue;
  }
  
  // Calcolo ponderato
  let weightedSum = 0;
  let currentBalance = initialValue;
  let previousDate = startDate;
  
  for (const deposit of depositsInPeriod) {
    const depositDate = new Date(deposit.deposit_date);
    const daysAtThisBalance = differenceInDays(depositDate, previousDate);
    
    // Peso = saldo × giorni a questo livello
    weightedSum += currentBalance * daysAtThisBalance;
    
    // Aggiorna saldo e data
    currentBalance += deposit.amount;
    previousDate = depositDate;
  }
  
  // Ultimo periodo (dall'ultimo versamento alla fine)
  const finalDays = differenceInDays(endDate, previousDate);
  weightedSum += currentBalance * finalDays;
  
  // Media ponderata
  return weightedSum / totalDays;
}
```

#### Esempio di calcolo dettagliato

```text
Data inizio: 01/01/2025 (valore: €100.000)
Versamento: 01/10/2025 (+€100.000)
Data fine: 01/01/2026

Calcolo:
- Periodo 1: 01/01 → 01/10 = 273 giorni a €100.000
- Periodo 2: 01/10 → 01/01 = 92 giorni a €200.000
- Totale: 365 giorni

Giacenza = (100.000 × 273 + 200.000 × 92) / 365
         = (27.300.000 + 18.400.000) / 365
         = 45.700.000 / 365
         = €125.205
```

### 6. UI Aggiornata

**Card Patrimonio Totale:**
```text
┌────────────────────┐
│ Patrimonio Totale  │
│ 200.000,00 €       │
│ al 30/01/2026      │  ← Data dall'Excel
└────────────────────┘
```

**Card Giacenza Media:**
```text
┌────────────────────┐
│ Giacenza Media     │
│ 125.205,00 € ✏️    │
│ Versamenti: 100.000│  ← Stile leggero
└────────────────────┘
```

## Riepilogo Modifiche

| File | Modifica |
|:-----|:---------|
| **Database** | Nuova colonna `snapshot_date` in `portfolios` |
| **src/types/portfolio.ts** | Aggiunta proprietà `snapshot_date` |
| **src/lib/excelParser.ts** | Funzione `extractSnapshotDate` + export nel risultato |
| **src/components/dashboard/FileUploader.tsx** | Salvataggio `snapshot_date` nel portfolio |
| **src/components/dashboard/Dashboard.tsx** | Passaggio `allDeposits` a StatsCards |
| **src/components/dashboard/StatsCards.tsx** | Nuova prop `allDeposits`, funzione `calculateTimeWeightedAverage`, UI con data e versamenti |

## Dettagli Tecnici

### Estrazione Data Excel

Pattern supportati nel parser:
```typescript
const datePatterns = [
  /POSIZIONE\s+AL\s+(\d{2})[\/\-](\d{2})[\/\-](\d{4})/i,
  /DATA[:\s]+(\d{2})[\/\-](\d{2})[\/\-](\d{4})/i,
  /(\d{2})[\/\-](\d{2})[\/\-](\d{4})/,
];

// Numeri seriali Excel (40000-50000 = ~2009-2036)
if (typeof cell === 'number' && cell > 40000 && cell < 50000) {
  const date = new Date((cell - 25569) * 86400 * 1000);
}
```

### Gestione Edge Cases

1. **Nessuna data storica selezionata:** Giacenza = 0, card dimmed
2. **Nessun versamento nel periodo:** Giacenza = Valore storico
3. **Data Excel mancante:** Usa data odierna come fallback
4. **Modifica manuale:** L'utente può sempre sovrascrivere con l'icona ✏️

### Dipendenze

Utilizzeremo `date-fns` (già installato) per:
- `differenceInDays` - calcolo giorni tra date
- `isWithinInterval` - verifica se data è nel range
- `parseISO` - parsing date ISO

