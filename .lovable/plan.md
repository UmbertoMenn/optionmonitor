

## Usare la colonna "Scadenza" dal file Excel invece di estrarla dal simbolo

### Problema

Attualmente la scadenza viene derivata dal simbolo dell'opzione con una funzione (`extractExpiryFromSymbol`). L'utente vuole invece leggere il dato direttamente dalla colonna "Scadenza" presente nel file Excel degli ordini.

### Soluzione

1. Aggiungere il mapping della colonna "Scadenza" nel parser degli ordini
2. Salvare il valore nel campo `ParsedOrder`
3. Mostrarlo nella tabella operazioni del calcolatore premi

### Dettaglio tecnico

**1. `src/lib/orderFileParser.ts`**

- Aggiungere `expiryDate` alla interface `ParsedOrder`:
  ```typescript
  expiryDate?: string; // Scadenza dal file Excel
  ```
- Aggiungere mapping in `COLUMN_MAPPINGS`:
  ```typescript
  expiryDate: ['Scadenza', 'scadenza', 'SCADENZA'],
  ```
- In `parseOrdersFromRawData`: cercare l'indice della colonna `expiryDate`, leggere il valore raw dalla riga e aggiungerlo all'oggetto `ParsedOrder`
- Rimuovere la funzione `extractExpiryFromSymbol` (non piu' necessaria)

**2. `src/components/derivatives/CallPremiumCalculatorDialog.tsx`**

- Rimuovere l'import di `extractExpiryFromSymbol`
- Nella cella "Scad.", mostrare `order.expiryDate` invece di `extractExpiryFromSymbol(order.symbol)`

### File da modificare

| File | Modifica |
|---|---|
| `src/lib/orderFileParser.ts` | Nuovo campo `expiryDate` in `ParsedOrder`, mapping colonna "Scadenza", rimozione `extractExpiryFromSymbol` |
| `src/components/derivatives/CallPremiumCalculatorDialog.tsx` | Usare `order.expiryDate` al posto di `extractExpiryFromSymbol(order.symbol)` |

