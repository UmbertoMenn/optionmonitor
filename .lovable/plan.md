

## Link OptionStrat Avanzato dalla Calcolatrice (Corretto)

### Obiettivo

Generare un link OptionStrat dalle operazioni della calcolatrice con supporto per quantita' multiple, operazioni vendute e posizioni chiuse.

### Correzione critica

La data di scadenza (YYMMDD) per ogni gamba viene estratta dal campo `expiryDate` del `ParsedOrder`, che corrisponde alla colonna "Data Scadenza" del file Excel. **NON** dal parsing del simbolo dell'opzione.

Il campo `expiryDate` e' gia' disponibile nell'interfaccia `ParsedOrder` (formato DD/MM/YYYY italiano). Verra' convertito in YYMMDD usando `toIsoDateFromIT` e poi `optionsExpirationDate` per ottenere il 3rd Friday corretto.

### Modifiche

**1. `src/lib/optionStratUrl.ts`** -- Nuova funzione `buildOptionStratUrlFromOrders`

- Input: `ParsedOrder[]`, `ticker: string`, `strategyName: string | null`
- Logica:
  1. Raggruppare gli ordini per `symbol`
  2. Per ogni gruppo con piu' ordini sullo stesso simbolo: ultimo nell'array = apertura, primo = chiusura (ordine cronologico invertito nell'Excel)
  3. Per ogni gamba:
     - Estrarre tipo (C/P) e strike dal simbolo (es. `CLSG6P90` -> P, 90)
     - Estrarre la scadenza dal campo `expiryDate` del ParsedOrder (es. `18/07/2025`)
     - Convertire in YYMMDD passando per `toIsoDateFromIT` -> `optionsExpirationDate(year, month)` -> formato `YYMMDD`
  4. Formattare ogni gamba:

| Caso | Formato |
|---|---|
| Venduto, aperta | `-.{TICKER}{YYMMDD}{C/P}{STRIKE}x{-N}@{prezzo}` |
| Comprato, aperta | `.{TICKER}{YYMMDD}{C/P}{STRIKE}x{N}@{prezzo}` |
| Chiusa | `[prefix].{TICKER}{YYMMDD}{C/P}{STRIKE}x{qty}@{prezzoApertura}@{prezzoChiusura}` |

  5. Comporre URL: `https://optionstrat.com/build/{slug}/{TICKER}/{legs}`

**2. `src/components/derivatives/CallPremiumCalculatorDialog.tsx`**

- Importare `buildOptionStratUrlFromOrders`
- Aggiungere pulsante con icona `ExternalLink` accanto a Salva/Reset
- Visibile solo quando `filteredOrders.length > 0`
- Al click: genera URL e apre in nuova tab

### Dettaglio: estrazione dati

Dal **simbolo** si estraggono solo:
- Tipo opzione (C o P) -- dalla lettera dopo la cifra dell'anno
- Strike -- dal numero finale

Dalla **colonna Excel "Data Scadenza"** (`expiryDate`):
- La data di scadenza effettiva (es. `18/07/2025`)
- Convertita in YYMMDD tramite le funzioni gia' esistenti

### Dettaglio: raggruppamento open/close (ordine invertito)

```text
filteredOrders (dall'Excel, piu' recente in cima):
  [0] CLSG6P95, buy,  qty=2, price=1.5, expiryDate=18/07/2025  <-- chiusura
  [1] CLSG6P95, sell, qty=2, price=2.8, expiryDate=18/07/2025  <-- apertura

Risultato gamba: -.CLS250718P95x-2@2.8@1.5
```

Se un simbolo appare una sola volta, e' una posizione aperta (senza prezzo chiusura).

