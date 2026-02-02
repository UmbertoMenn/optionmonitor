

# Piano: Pulire i Campi Legacy dal Portfolio

## Obiettivo

Rimuovere i valori legacy (`initial_value`, `deposits`, `average_balance`, `average_balance_date`) dalla tabella `portfolios` per forzare l'uso esclusivo dei dati storici nella tabella `historical_data`.

## Stato Attuale

Dal controllo effettuato:
- **Portfolio Principale** (id: `db026b04-...`): Ha dati legacy salvati
  - `initial_value`: 670,000
  - `average_balance`: 595,000
  - `deposits`: 0
- **historical_data**: Tabella vuota
- **deposits**: Tabella vuota

## Operazione da Eseguire

Eseguire un UPDATE SQL per azzerare i campi legacy:

```sql
UPDATE portfolios 
SET 
  initial_value = NULL,
  initial_date = NULL,
  deposits = NULL,
  average_balance = NULL,
  average_balance_date = NULL
WHERE id = 'db026b04-1a5b-4ede-a419-1a5e4215efad';
```

## Risultato Atteso

Dopo la pulizia:

1. **Dashboard senza dati storici**: Il P/L mostrera `—` (trattino) invece di valori calcolati
2. **Flusso corretto**: Per avere il P/L, l'utente dovra:
   - Salvare uno snapshot storico tramite il pulsante "Salva Snapshot"
   - I calcoli useranno solo i dati dalla tabella `historical_data`

## Verifica del Comportamento UI

Il codice in `StatsCards.tsx` gia gestisce questo caso:

```typescript
// Se non ci sono dati storici E non ci sono dati iniziali nel portfolio
if (!hasHistoricalData && !hasInitialData) {
  return { absolute: 0, percent: 0 }; // Mostra "—" nella UI
}
```

## File da Modificare

Nessun file da modificare - solo operazione di pulizia dati nel database.

## Azione

Eseguiro l'UPDATE SQL per pulire i campi legacy dal Portfolio Principale.

