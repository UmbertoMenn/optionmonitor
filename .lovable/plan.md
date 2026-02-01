

# Piano: Correzione Completa Scraper ETF e Reset Cache

## Problema Identificato

Lo scraper `fetch-etf-allocation` mescola dati **settoriali** con dati **geografici**, causando esposizioni valutarie errate per tutti gli ETF nel sistema.

### Esempio del Bug

| Dati Estratti | Tipo | Corretto? |
|--------------|------|-----------|
| United States: 47.82% | Paese | ✅ |
| Financials: 22.28% | Settore | ❌ |
| Technology: 15.5% | Settore | ❌ |

**Conseguenza**: Totale > 100% → Normalizzazione → Valori diluiti

---

## Fase 1: Migliorare lo Scraper

### Modifiche a `supabase/functions/fetch-etf-allocation/index.ts`

#### 1.1 Aggiungere lista di settori da escludere

```typescript
const SECTOR_KEYWORDS = [
  'Financials', 'Financial', 'Technology', 'Healthcare', 
  'Consumer', 'Energy', 'Industrials', 'Materials', 
  'Utilities', 'Real Estate', 'Communication', 
  'IT', 'Discretionary', 'Staples', 'Services', 
  'Sector', 'Industry', 'Basic', 'Telecom'
];
```

#### 1.2 Funzione di validazione paese

```typescript
function isValidCountry(name: string): boolean {
  // Se contiene keyword settoriale, non è un paese
  const upperName = name.toUpperCase();
  for (const sector of SECTOR_KEYWORDS) {
    if (upperName.includes(sector.toUpperCase())) {
      return false;
    }
  }
  
  // Verificare che sia nella mappa paesi conosciuti
  return getCurrencyFromCountry(name) !== 'OTHER' || 
         COUNTRY_TO_CURRENCY[name] !== undefined;
}
```

#### 1.3 Migliorare il parsing HTML

```typescript
// Cercare specificamente sezioni geografiche
const countryPatterns = [
  /Countries[\s\S]*?<table([\s\S]*?)<\/table>/i,
  /Länder[\s\S]*?<table([\s\S]*?)<\/table>/i,
  /Paesi[\s\S]*?<table([\s\S]*?)<\/table>/i,
];

// Estrarre righe solo dalla sezione corretta
// Validare ogni voce con isValidCountry()
```

#### 1.4 Validazione finale

```typescript
// Se il totale supera 110%, probabilmente c'è un errore
const total = Object.values(countryAllocations).reduce((a, b) => a + b, 0);
if (total > 110) {
  console.warn(`Total allocations ${total}% exceeds 100%, filtering sectors...`);
  // Rimuovere voci che sembrano settori
}
```

---

## Fase 2: Reset Cache Completa

### Eliminare tutti i dati ETF cached

```sql
-- Cancellare TUTTI i record dalla tabella etf_allocations
DELETE FROM etf_allocations;
```

Questo forzerà il re-fetch di tutti gli ETF al prossimo accesso alla vista Currency Exposure.

---

## Fase 3: Ricalcolo Automatico

Il sistema già prevede il refresh automatico:

```text
1. Utente carica nuovo Excel o naviga su Currency Exposure
2. Hook useETFAllocations rileva ETF senza cache
3. Chiama edge function fetch-etf-allocation per ogni ETF
4. Edge function usa lo scraper CORRETTO
5. Dati salvati in cache con valori geografici puri
6. UI mostra esposizioni valutarie corrette
```

---

## Flusso di Correzione

```text
┌─────────────────────────────────────────────────────────┐
│  FASE 1: Deploy Scraper Corretto                        │
├─────────────────────────────────────────────────────────┤
│  1. Aggiungere SECTOR_KEYWORDS                          │
│  2. Implementare isValidCountry()                       │
│  3. Migliorare parsing sezione geografica               │
│  4. Aggiungere validazione totale                       │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  FASE 2: Reset Cache                                    │
├─────────────────────────────────────────────────────────┤
│  DELETE FROM etf_allocations;                           │
│  (elimina tutti i dati cached errati)                   │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  FASE 3: Ricalcolo Automatico                           │
├─────────────────────────────────────────────────────────┤
│  1. Utente naviga su Currency Exposure                  │
│  2. Sistema rileva cache vuota                          │
│  3. Fetch automatico per ogni ETF                       │
│  4. Scraper corretto estrae solo dati geografici        │
│  5. Nuovi dati salvati in cache                         │
└─────────────────────────────────────────────────────────┘
```

---

## File da Modificare

| File | Azione |
|------|--------|
| `supabase/functions/fetch-etf-allocation/index.ts` | Migliorare parsing per escludere settori |
| Database `etf_allocations` | Svuotare tabella (DELETE) |

---

## Risultato Atteso

### Prima (dati errati per tutti gli ETF)

| ETF | USD Mostrato | USD Reale |
|-----|-------------|-----------|
| SPDR S&P Global Dividend | 39.1% | 47.82% |
| iShares MSCI World | ~55% | ~70% |
| Vanguard FTSE All-World | ~45% | ~60% |

### Dopo (dati corretti)

| ETF | USD Mostrato | USD Reale |
|-----|-------------|-----------|
| SPDR S&P Global Dividend | 47.82% | 47.82% ✅ |
| iShares MSCI World | ~70% | ~70% ✅ |
| Vanguard FTSE All-World | ~60% | ~60% ✅ |

---

## Dettagli Tecnici

### Logica di Normalizzazione Esistente (NON modificare)

Il file `src/lib/etfCurrencyDecomposition.ts` normalizza già i pesi a 100%:

```typescript
function normalizeCurrencyWeights(weights) {
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  return Object.fromEntries(
    Object.entries(weights).map(([k, v]) => [k, (v / sum) * 100])
  );
}
```

Questa logica è corretta e necessaria per gestire piccole variazioni nei dati. Il problema è che riceve dati > 100% a causa dei settori mescolati.

### Verifica Post-Deploy

1. Svuotare la cache ETF
2. Navigare su Risk Analyzer → Currency Exposure
3. Verificare i log dell'edge function per confermare parsing corretto
4. Controllare che USD per SPDR S&P Global Dividend mostri ~47.82%

