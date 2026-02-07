

# Piano: Persistenza Premi Covered Call e Gestione Operazioni Cumulative

## Obiettivo
1. **Salvare in database** i calcoli dei premi covered call (netto commissioni, operazioni, date)
2. **Pulizia automatica** quando una covered call non esiste più nel portafoglio
3. **Mostrare "UNIT: X.XX $"** sulla riga della covered call (come indicatore del netto unitario calcolato)
4. **Aggiunta cumulativa** di operazioni da nuovi file Excel senza perdere le precedenti
5. **Mostrare "Data ultima operazione"** accanto al conteggio operazioni nell'intestazione collapsible

---

## Modifiche Database

### Nuova tabella: `covered_call_premiums`

| Colonna | Tipo | Descrizione |
|---------|------|-------------|
| id | uuid (PK) | Identificatore univoco |
| portfolio_id | uuid (FK) | Riferimento al portafoglio |
| ticker | text | Ticker del sottostante (es. BABA) |
| underlying | text | Nome sottostante (es. Alibaba Group) |
| orders_json | jsonb | Array di operazioni salvate |
| transaction_cost | numeric | Costo per transazione (default 10) |
| net_per_share | numeric | Netto unitario calcolato |
| first_operation_date | date | Data prima operazione |
| last_operation_date | date | Data ultima operazione |
| contracts_count | integer | Numero contratti usati nel calcolo |
| updated_at | timestamptz | Ultimo aggiornamento |
| created_at | timestamptz | Creazione |

**RLS Policy**: Accesso solo per owner del portafoglio (tramite join con portfolios.user_id)

---

## Logica di Persistenza

### Al salvataggio/aggiornamento dei premi

1. **Chiave univoca**: `(portfolio_id, ticker)` - una riga per ticker per portafoglio
2. **Quando l'utente carica un nuovo Excel**:
   - Recupera le operazioni esistenti da DB per quel ticker
   - Unisce le nuove operazioni (evitando duplicati basati su `symbol + operation + avgPrice + quantity + validityDate`)
   - Ricalcola metriche (netto, date, rendimenti)
   - Salva in DB

### Al caricamento del portafoglio (cleanup)

1. Quando `strategy_cache` viene aggiornato (in `saveStrategyCache`):
   - Estrae la lista di ticker delle Covered Call attive
   - Cancella dalla tabella `covered_call_premiums` i record con ticker che non esistono più nelle CC attive

---

## Modifiche UI

### 1. CoveredCallRow (Derivatives.tsx)

**Attuale grid**: 11 colonne
**Nuova grid**: +1 colonna per "UNIT: X.XX $"

Dopo la colonna "Menu" e prima di "PS", aggiungere:
```text
UNIT: $13,45
```
- Colore: testo verde se positivo, rosso se negativo
- Tooltip: "Netto unitario premi CALL"
- Se non c'è dato salvato: mostrare "-" o nascondere

### 2. CallPremiumCalculatorDialog

**Modifica al comportamento del caricamento file**:
- Al primo render, carica le operazioni salvate da DB (se esistono)
- Mostra subito le metriche calcolate dalle operazioni salvate
- Il pulsante "Nuovo file" ora dice "Aggiungi operazioni"
- Quando si carica un nuovo file:
  - Merge con operazioni esistenti (dedup)
  - Ricalcola metriche
  - Aggiorna stato locale (non salva ancora)
- Nuovo pulsante "Salva" per persistere in DB
- Pulsante "Reset" per cancellare tutto (con conferma)

**Modifica all'intestazione "Operazioni (15)"**:
```text
📋 Operazioni (15) | Ultima: 06/02/2026
```
oppure:
```text
📋 Operazioni (15) — Data ultima: 06/02/2026
```

### 3. Nuovo Hook: useCoveredCallPremiums

```typescript
interface CoveredCallPremium {
  id: string;
  portfolio_id: string;
  ticker: string;
  underlying: string;
  orders_json: ParsedOrder[];
  transaction_cost: number;
  net_per_share: number;
  first_operation_date: string | null;
  last_operation_date: string | null;
  contracts_count: number;
}

function useCoveredCallPremiums(portfolioId: string | undefined) {
  // Query per recuperare tutti i record per il portfolio
  // Mutation per upsert
  // Mutation per delete
}
```

---

## Flusso Utente

1. **Prima volta**: L'utente apre la calcolatrice, vede "Nessun dato salvato", carica Excel, vede le operazioni, clicca "Salva"
2. **Visite successive**: Apre la calcolatrice, vede subito le operazioni e metriche salvate
3. **Aggiunta operazioni**: Clicca "Aggiungi operazioni", carica nuovo Excel, il sistema merge, clicca "Salva"
4. **Rimozione singole righe**: L'utente rimuove righe, metriche si aggiornano, deve cliccare "Salva" per persistere
5. **Cleanup automatico**: Quando l'utente carica un nuovo Excel portafoglio e una covered call sparisce, i premi associati vengono cancellati automaticamente

---

## File Coinvolti

| File | Modifiche |
|------|-----------|
| **Nuova migrazione SQL** | Crea tabella `covered_call_premiums` con RLS |
| `src/hooks/useCoveredCallPremiums.ts` (nuovo) | Hook per CRUD dei premi salvati |
| `src/lib/strategyCache.ts` | Aggiunge cleanup dei premi orfani dopo save |
| `src/components/derivatives/CallPremiumCalculatorDialog.tsx` | Load da DB, merge operazioni, salvataggio, UI aggiornata |
| `src/pages/Derivatives.tsx` | Mostra "UNIT: X.XX $" nella riga CC, passa dati salvati |
| `src/lib/orderFileParser.ts` | (opzionale) Aggiunge utility `findLastOperationDate` |

---

## Esempio Visivo

### Riga Covered Call (con UNIT)
```
> V | BABA CALL 165 FEB/26 | ITM | ⚙️ | UNIT: $13,45 | PS: $98,50 | 1×100 | $8,40 | $7,20 +5.2%
```

### Accordion Operazioni
```
📋 Operazioni (15) — Ultima: 06/02/2026
```

---

## Dettagli Tecnici

### Deduplicazione Operazioni

Per evitare duplicati quando si caricano più Excel:
```typescript
const orderKey = (o: ParsedOrder) => 
  `${o.symbol}|${o.operation}|${o.avgPrice}|${o.quantity}|${o.validityDate || ''}`;

const merged = [...existingOrders];
const existingKeys = new Set(existingOrders.map(orderKey));
for (const newOrder of newOrders) {
  if (!existingKeys.has(orderKey(newOrder))) {
    merged.push(newOrder);
  }
}
```

### Utility findLastOperationDate

Simile a `findFirstOperationDate` ma restituisce la data più recente:
```typescript
export function findLastOperationDate(validityDates: (string | undefined)[]): string | null {
  const isoDates = validityDates
    .map(d => toIsoDateFromIT(d))
    .filter((d): d is string => d !== null);
  
  if (isoDates.length === 0) return null;
  return isoDates.sort().reverse()[0]; // Data più recente
}
```

---

## RLS Policy

```sql
-- Solo l'owner del portfolio può accedere ai propri premi
CREATE POLICY "Users can manage their own covered call premiums"
ON covered_call_premiums
FOR ALL
USING (
  portfolio_id IN (
    SELECT id FROM portfolios WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  portfolio_id IN (
    SELECT id FROM portfolios WHERE user_id = auth.uid()
  )
);
```

