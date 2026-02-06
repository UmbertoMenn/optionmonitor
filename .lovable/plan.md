
# Piano: Correzione Definitiva - ETF e Sector Allocation

## Diagnosi Completa

### Problema Principale Identificato
Il codice modificato in precedenza (`RiskAnalyzer.tsx`) usa correttamente `stock.isETF`, ma i file `sectorExposure.ts` e `currencyExposure.ts` usano ancora funzioni di pattern matching che falliscono:

| File | Linea | Problema |
|------|-------|----------|
| `sectorExposure.ts` | 342 | `isETFByName(stock.underlying)` invece di `stock.isETF` |
| `currencyExposure.ts` | 128 | `isETFByDescription(stock.underlying)` invece di `stock.isETF` |

### Perche il Pattern Matching Fallisce

Esempio dal database:
- **ETF**: "Amundi MSCI China Tech UCITS ETF EUR" - potrebbe matchare ma alcuni ETF hanno nomi abbreviati
- **Stock**: "AZ.APPLE INC" - il prefisso "AZ." non e nel pattern e "APPLE" non corrisponde a "AAPL"

La struttura `StockRiskDetail` ha gia il campo `isETF: boolean` (impostato correttamente in `riskCalculator.ts` linea 280 basandosi su `asset_type === 'etf'`), ma non viene utilizzato in `sectorExposure.ts` e `currencyExposure.ts`.

### Flusso dei Dati

```text
positions (DB) --> riskCalculator.ts --> StockRiskDetail { isETF: boolean }
                                              |
                   +-------------------------+-------------------------+
                   |                         |                         |
            RiskAnalyzer.tsx          sectorExposure.ts         currencyExposure.ts
            (usa stock.isETF)         (usa isETFByName())       (usa isETFByDescription())
                   OK                        ERRORE                    ERRORE
```

---

## Modifiche Richieste

### Modifica 1: `sectorExposure.ts` - Usare `stock.isETF`

**Linea 342**: Sostituire pattern matching con il flag esistente:

```typescript
// PRIMA (non funziona)
const isETF = isETFByName(stock.underlying);

// DOPO (usa il flag dalla struttura)
const isETF = stock.isETF;
```

Questo garantisce che tutti gli 8 ETF con `asset_type = 'etf'` vengano riconosciuti correttamente, indipendentemente dal loro nome.

### Modifica 2: `currencyExposure.ts` - Usare `stock.isETF`

**Linea 128**: Sostituire pattern matching con il flag esistente:

```typescript
// PRIMA (non funziona)
const isETF = isETFByDescription(stock.underlying);

// DOPO (usa il flag dalla struttura)
const isETF = stock.isETF;
```

### Modifica 3: Cleanup - Rimuovere funzioni/costanti non piu usate

Dopo le modifiche, le seguenti funzioni/costanti non sono piu necessarie:

| File | Elemento | Azione |
|------|----------|--------|
| `sectorExposure.ts` | `ETF_PATTERN` (linea 227) | Rimuovere se non usato altrove |
| `sectorExposure.ts` | `isETFByName()` (linea 229-231) | Rimuovere |
| `currencyExposure.ts` | `ETF_ISSUER_PATTERNS` (linee 83-96) | Rimuovere |
| `currencyExposure.ts` | `isETFByDescription()` (linee 98-101) | Rimuovere |

### Modifica 4: Aggiungere log diagnostici temporanei

Per verificare il corretto funzionamento dopo le modifiche, aggiungere log in `sectorExposure.ts`:

```typescript
// In calculateSectorExposure, dopo la linea 336
console.log('[Sector] Processing stock:', {
  name: stock.underlying,
  isETF: stock.isETF,
  isin: stock.isin,
  hasAllocation: stock.isETF && stock.isin ? !!etfAllocations[stock.isin] : 'N/A'
});
```

E in `RiskAnalyzer.tsx`:

```typescript
// Dopo la linea 60 nel useMemo etfIsins
console.log('[RiskAnalyzer] ETF ISINs extracted:', isins.length, isins);
```

---

## Riepilogo File da Modificare

| File | Modifiche |
|------|-----------|
| `src/lib/sectorExposure.ts` | Linea 342: usare `stock.isETF`; rimuovere `ETF_PATTERN` e `isETFByName()` |
| `src/lib/currencyExposure.ts` | Linea 128: usare `stock.isETF`; rimuovere `ETF_ISSUER_PATTERNS` e `isETFByDescription()` |
| `src/pages/RiskAnalyzer.tsx` | Aggiungere log diagnostico (temporaneo) |

---

## Risultato Atteso

### Prima delle modifiche
- ETF analizzati: 0
- Sector "Other": AZ.APPLE INC, AZ.ALPHABET, ecc.
- Currency Exposure: ETF non scomposti per valuta

### Dopo le modifiche
- ETF analizzati: 8 (tutti quelli con `asset_type = 'etf'`)
- Sector: APPLE → Technology, NVIDIA → Technology, ecc.
- Currency Exposure: ETF correttamente scomposti per valuta in base alle allocazioni

---

## Prevenzione Future Regressioni

1. **Flag `isETF` centralizzato**: Tutti i moduli useranno il flag dalla struttura `StockRiskDetail` invece di pattern matching indipendenti
2. **Eliminazione duplicazioni**: Rimuovere le funzioni `isETFByName()` e `isETFByDescription()` elimina la possibilita di disallineamenti
3. **Test consigliato**: Dopo le modifiche, verificare in console che `etfIsins.length > 0` e che gli strumenti appaiano nei settori corretti
