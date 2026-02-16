

## Link OptionStrat Avanzato dalla Calcolatrice

### Obiettivo

Generare un link OptionStrat basato sulle operazioni caricate nella calcolatrice, con supporto per:
- Quantita' multiple: `.CLS250718P90x2@1.5`
- Operazioni vendute: `-.CLS250718P95x-2@2.8`
- Posizioni chiuse (con prezzo chiusura): `-.CLS250718P95x-2@2.8@1.5`

### Nota importante: ordine cronologico invertito

Nel file Excel le operazioni sono ordinate dalla piu' recente (in cima) alla piu' vecchia (in basso). Quindi nell'array `filteredOrders`:
- Indice 0 = operazione piu' recente
- Ultimo indice = operazione piu' vecchia

Per determinare apertura/chiusura di una posizione sullo stesso simbolo, l'**ultima** nell'array e' l'apertura, la **prima** e' la chiusura.

### Modifiche

**1. `src/lib/optionStratUrl.ts`** -- Nuova funzione

Aggiungere `buildOptionStratUrlFromOrders(orders: ParsedOrder[], ticker: string, strategyName: string | null): string`

Logica:
1. Raggruppare gli ordini per `symbol`
2. Per ogni gruppo con piu' di un ordine sullo stesso simbolo:
   - L'ultimo nell'array (indice piu' alto) e' l'apertura
   - Il primo nell'array (indice piu' basso) e' la chiusura
3. Parsing del simbolo (es. `CLSG6P90`):
   - Estrarre ticker, month-code (A=Gen...L=Dic), year-digit, C/P, strike
   - Calcolare YYMMDD con `optionsExpirationDate(year, month)`
4. Formattare ogni gamba:

| Caso | Formato |
|---|---|
| Venduto, aperta | `-.{TICKER}{YYMMDD}{C/P}{STRIKE}x{-N}@{prezzo}` |
| Comprato, aperta | `.{TICKER}{YYMMDD}{C/P}{STRIKE}x{N}@{prezzo}` |
| Chiusa (apertura + chiusura) | `[prefix].{TICKER}{YYMMDD}{C/P}{STRIKE}x{qty}@{prezzoApertura}@{prezzoChiusura}` |

5. Comporre URL: `https://optionstrat.com/build/{slug}/{TICKER}/{legs}`

**2. `src/components/derivatives/CallPremiumCalculatorDialog.tsx`**

- Importare `buildOptionStratUrlFromOrders`
- Aggiungere un pulsante con icona `ExternalLink` nella barra dei pulsanti (accanto a Salva/Reset)
- Visibile solo quando `filteredOrders.length > 0`
- Al click: genera URL e apre in nuova tab

### Dettaglio: parsing simbolo

```text
Esempio: CLSG6P90
- CLS   = ticker
- G     = mese 7 (Luglio) -- A=1, B=2, ..., L=12
- 6     = anno 2026
- P     = Put
- 90    = strike
```

### Dettaglio: raggruppamento open/close (ordine invertito)

```text
filteredOrders (dall'Excel, piu' recente in cima):
  [0] CLSG6P95, buy,  qty=2, price=1.5  <-- chiusura (piu' recente)
  [1] CLSG6P95, sell, qty=2, price=2.8  <-- apertura (piu' vecchia)

Risultato gamba: -.CLS250718P95x-2@2.8@1.5
```

Se un simbolo appare una sola volta, e' una posizione aperta (senza prezzo chiusura).

