

## Correzione: Link OptionStrat dalle righe strategia con dati storici Excel

### Problema

I pulsanti OptionStrat sulle righe delle strategie (Covered Call, Iron Condor, ecc.) nella pagina Derivatives usano solo le posizioni attuali in portafoglio tramite le funzioni `buildCoveredCallUrl`, `buildIronCondorUrl`, ecc. Non considerano lo storico delle operazioni caricate dall'Excel e salvate nel database.

I dati storici sono gia' disponibili: ogni riga ha accesso a `savedPremium` (tramite `getPremiumByTickerAndSymbol`) che contiene il campo `orders_json` con tutte le operazioni Excel.

### Soluzione

Per le righe **Covered Call** e **Iron Condor** (le uniche con calcolatrice), quando esistono ordini Excel salvati (`savedPremium?.orders_json.length > 0`), il pulsante OptionStrat deve usare `buildOptionStratUrlFromOrders` invece della funzione basata sulle posizioni attuali.

### Modifiche

**1. `src/pages/Derivatives.tsx` -- Riga Covered Call (circa riga 745)**

Attualmente:
```
<OptionStratButton url={ticker ? buildCoveredCallUrl(ticker, option) : null} />
```

Diventa:
```
<OptionStratButton url={
  ticker
    ? (savedPremium?.orders_json?.length
        ? buildOptionStratUrlFromOrders(savedPremium.orders_json, ticker, null)
        : buildCoveredCallUrl(ticker, option))
    : null
} />
```

**2. `src/pages/Derivatives.tsx` -- Riga Iron Condor (circa riga 1163)**

Attualmente:
```
<OptionStratButton url={...buildIronCondorUrl(ticker, boughtPut, soldPut, soldCall, boughtCall)...} />
```

Diventa:
```
<OptionStratButton url={
  ticker
    ? (savedPremium?.orders_json?.length
        ? buildOptionStratUrlFromOrders(savedPremium.orders_json, ticker, 'Iron Condor')
        : buildIronCondorUrl(ticker, boughtPut, soldPut, soldCall, boughtCall))
    : null
} />
```

**3. `src/pages/Derivatives.tsx` -- Import**

Aggiungere `buildOptionStratUrlFromOrders` all'import esistente da `@/lib/optionStratUrl`.

### Comportamento

- Se ci sono ordini Excel salvati per quella strategia/ticker: il link include tutto lo storico (operazioni aperte e chiuse, con quantita' e prezzi)
- Se non ci sono ordini salvati: fallback al link basato sulle posizioni attuali in portafoglio (comportamento attuale)
- Il pulsante nel dialog della calcolatrice resta invariato (gia' funzionante)

### Note

Le altre strategie (Naked Put, LEAP, Long Put, Double Diagonal, Grouped) non hanno la calcolatrice quindi continuano a usare il link basato sulle posizioni attuali.
