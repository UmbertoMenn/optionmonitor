
# Piano: Upload Excel per Dati Storici Automatico

## Obiettivo
Aggiungere la possibilita di caricare un file Excel nella sezione Dati Storici. Il sistema estrarra automaticamente:
- **Data snapshot** dal file Excel (cella C4 o pattern "POSIZIONE AL")
- **Patrimonio Totale** calcolato dalla somma dei market_value + cash
- **Netting values** calcolati automaticamente in base alle posizioni derivate

Nessuna compilazione manuale richiesta - tutto viene estratto e calcolato dal file.

## Come Funziona

```text
Utente carica Excel in "Dati Storici"
              |
              v
+----------------------------------+
|  parsePortfolioExcel(file)       |
|  - Estrae posizioni              |
|  - Estrae cashValue              |
|  - Estrae snapshotDate           |
+----------------------------------+
              |
              v
+----------------------------------+
|  Calcola totali:                 |
|  - totalValue = sum(market_value)|
|                 + cashValue      |
|  - Calcola netting dai derivati  |
+----------------------------------+
              |
              v
+----------------------------------+
|  Salva in historical_data:       |
|  - snapshot_date                 |
|  - total_value                   |
|  - netting_total                 |
|  - netting_ex_cc                 |
|  - netting_ex_cc_np              |
+----------------------------------+
```

## Modifiche Tecniche

### 1. Nuovo parser per calcolo netting stand-alone

Creare `src/lib/historicalNettingCalculator.ts`:

Dato che il calcolo del netting attualmente usa gli hook React, servira una versione stand-alone che lavora direttamente sulle posizioni parsate:

```typescript
// Calcola i valori di netting dalle posizioni parsate
export function calculateNettingFromPositions(
  positions: Position[], 
  cashValue: number
): {
  totalValue: number;
  nettingTotal: number;
  nettingExCC: number;
  nettingExCCNP: number;
}
```

La logica riutilizzera quella esistente in `useDerivativeNetting.ts` ma senza dipendenze React.

### 2. Modifica: `src/components/dashboard/HistoricalDataForm.tsx`

Aggiungere un mini-uploader nella sezione:

- Pulsante "Carica da Excel" accanto a "Aggiungi dato storico"
- Dropzone compatta per trascinare il file
- Al caricamento:
  1. Parsa il file con `parsePortfolioExcel`
  2. Calcola totali con `calculateNettingFromPositions`
  3. Salva automaticamente con `onSave`
  4. Mostra toast di conferma con data e valori estratti

### 3. Interfaccia utente

La sezione "Dati Storici" avra:

```text
+------------------------------------------+
|  Dati Storici                    [^/v]   |
|------------------------------------------|
|  [+ Aggiungi manuale] [📄 Carica Excel]  |
|                                          |
|  --- oppure trascina un file qui ---     |
|                                          |
|  Dati salvati:                           |
|  - 15 Gen 2025 | $102.500 | ...    [X]   |
|  - 01 Gen 2025 | $100.000 | ...    [X]   |
+------------------------------------------+
```

## File da Modificare/Creare

| File | Azione |
|------|--------|
| `src/lib/historicalNettingCalculator.ts` | **NUOVO** - Calcolo netting stand-alone |
| `src/components/dashboard/HistoricalDataForm.tsx` | Aggiungere upload Excel |

## Calcolo Netting Stand-Alone

Il calcolo deve replicare la logica esistente:

1. **Patrimonio Totale**: Somma di tutti i `market_value` + `cashValue`
2. **Netting Totale**: Patrimonio - abs(sum derivati negativi)
3. **Netting ex Covered Call**: Come sopra ma esclude le call corte su sottostanti posseduti
4. **Netting ex CC e NP OTM**: Come sopra ma esclude anche le put corte OTM

Per identificare covered call e naked put OTM servira:
- Verificare se esiste una posizione azionaria per lo stesso underlying
- Per le put, servirebbero i prezzi correnti (non disponibili nel file storico)

**Semplificazione proposta per dati storici**:
- Il file storico non ha prezzi aggiornati, quindi per le put OTM useremo un'euristica basata sullo strike vs prezzo di carico della posizione sottostante (se presente)

## Vantaggi

- **Zero compilazione manuale**: Basta trascinare il file
- **Consistenza**: Usa lo stesso parser del portfolio
- **Velocita**: Importa anni di dati storici in pochi secondi
- **Accuratezza**: Calcoli automatici basati sui dati reali del file
