

## Uniformare i prezzi sottostanti a quelli live (Yahoo/cron) in tutte le strategie

### Problema attuale

I badge ITM/OTM/IR/OOR/IB/OOB/G/L usano sorgenti dati diverse a seconda della strategia:

| Strategia | Sorgente attuale | Si aggiorna col cron? |
|---|---|---|
| Iron Condor | `underlyingPrices[underlying].price` (Yahoo) | SI |
| Double Diagonal | `underlyingPrices[underlying].price` (Yahoo) | SI |
| Covered Call | `underlying.current_price` (Excel) | NO |
| Long Put | `underlying.current_price` (Excel) | NO |
| Naked Put | Excel con fallback Yahoo | Parzialmente |
| Leap Call | Excel con fallback Yahoo | Parzialmente |
| Altre Strategie (riga principale) | Excel con fallback Yahoo | Parzialmente |
| Altre Strategie (gambe singole) | `underlying.current_price` (Excel) | NO |

### Soluzione

Uniformare TUTTE le righe per usare **sempre** `underlyingPrices[...].price` (il prezzo live da Yahoo, aggiornato ogni 5 minuti dal cron job), come gia fanno Iron Condor e Double Diagonal.

### Modifiche al file `src/pages/Derivatives.tsx`

**1. CoveredCallRow** (linea 678)
- Da: `const underlyingPrice = underlying.current_price || 0;`
- A: `const underlyingPrice = (option.underlying ? underlyingPrices[option.underlying]?.price : 0) || 0;`
- Stessa modifica per la prop `underlyingPrice` del `CallPremiumCalculatorDialog` (linea 911)

**2. LongPutRow** (linea 927)
- Da: `const underlyingPrice = underlying?.current_price || 0;`
- A: `const underlyingPrice = (option.underlying ? underlyingPrices[option.underlying]?.price : 0) || 0;`

**3. NakedPutRow** (linee 2009-2011)
- Da: logica con `portfolioPrice > 0 ? portfolioPrice : yahooPrice`
- A: `const underlyingPrice = (option.underlying ? underlyingPrices[option.underlying]?.price : 0) || 0;`
- Rimuovere le variabili `portfolioPrice` e `yahooPrice`

**4. LeapCallRow** (linee 2163-2165)
- Da: logica con `portfolioPrice > 0 ? portfolioPrice : yahooPrice`
- A: `const underlyingPrice = (option.underlying ? underlyingPrices[option.underlying]?.price : 0) || 0;`
- Rimuovere le variabili `portfolioPrice` e `yahooPrice`

**5. GroupedOtherStrategyRow** (linee 1559-1561)
- Da: logica con `portfolioPrice > 0 ? portfolioPrice : yahooPrice`
- A: `const underlyingPrice = underlyingPrices[underlying]?.price || 0;` (come Iron Condor)
- Rimuovere le variabili `portfolioPrice` e `yahooPrice`

**6. GroupedOptionLegRow** (linea 1814)
- Da: `const underlyingPrice = underlying?.current_price || 0;`
- A: riceve `underlyingPrices` come prop e usa `underlyingPrices[option.underlying || '']?.price || 0;`
- Aggiornare anche la chiamata al componente (linea 1790) per passare `underlyingPrices`

### Risultato

Dopo questa modifica, tutti i badge (ITM/OTM/IR/OOR/IB/OOB/G/L) si aggiorneranno in tempo reale con il cron job ogni 5 minuti, garantendo coerenza tra tutte le sezioni della pagina Strategie Derivati.

### Nessun impatto su

- Dashboard e Risk Analyzer (continuano a usare i prezzi snapshot Excel, come da politica sorgenti dati)
- Edge Function `check-alerts` e `daily-briefing` (usano `underlying_prices` dal DB)
- Nessuna modifica al database

