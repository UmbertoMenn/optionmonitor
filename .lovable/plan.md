

## Fix matching nel briefing server-side

### Problema identificato
Le stock positions nel database hanno `ticker: null` e descriptions con prefisso `"AZ."` (es. `"AZ.NVIDIA CORP"`, `"AZ.APPLE INC"`, `"AZ.ALPHABET INC-CL A"`).

Il codice server-side usa `stock.ticker || stock.description.split(" ")[0]` che produce chiavi come `"AZ.NVIDIA"` -- completamente diverse dai ticker in `strategy_cache` (`"NVDA"`, `"AAPL"`, ecc.).

Il frontend usa `getCanonicalKey` / `normalizeForMatching` con `SPECIAL_ALIASES` per normalizzare correttamente i nomi e matcharli.

### Soluzione
Replicare nel file `supabase/functions/daily-briefing/index.ts` le funzioni di normalizzazione dal frontend (`src/lib/derivativeStrategies.ts`):

1. **`normalizeForMatching()`** - Rimuove prefisso `AZ.`, parentesi, suffissi (`INC`, `CORP`, `LTD`, `CLASS A/C`, `ADR`, `SPA`, ecc.), gestisce i punti tra abbreviazioni
2. **`getCanonicalKey()`** - Cerca match in `SPECIAL_ALIASES` (Google/Alphabet, JP Morgan, Amazon.com, Apple Computer, ecc.)
3. **`getMatchingKey()`** - Wrapper: `getCanonicalKey(text) || normalizeForMatching(text)`

### Modifiche nel file

**Aggiungere** (prima di `computeSectionsFromCache`):
- Costante `SPECIAL_ALIASES` con tutte le voci dal frontend (ALPHABET/GOOGLE, APPLE, JPMORGAN, AMAZON)
- Funzione `normalizeForMatching()` con identica logica regex
- Funzione `getCanonicalKey()` con identica logica di lookup
- Funzione `getMatchingKey()` wrapper

**Modificare** `computeSectionsFromCache()`:
- Sezione 1 (Call non coperte): usare `getMatchingKey(stock.description)` per le stock e `getMatchingKey(s.underlying)` per le strategie, invece di `stock.ticker` e `displayTicker(s)`
- Sezione 7 (Call da rivendere): stesso fix di matching
- Il confronto deve avvenire sulla chiave normalizzata, non sul ticker raw

### Cosa NON cambia
- Le sezioni 2-6 e 8 non usano matching stock/opzioni (usano solo `strategy_cache` + `underlying_prices`), quindi restano corrette
- La formattazione dei messaggi resta identica
- Il fallback monitoring_snapshot resta
- Il display ticker per i messaggi di output continua a usare `s.ticker || s.underlying` (solo per mostrare il nome, non per il matching)

### Dettaglio tecnico

Per le sezioni 1 e 7, il matching funzionera cosi:

```text
Stock: "AZ.NVIDIA CORP" 
  → normalizeForMatching → "NVIDIA"
  → getMatchingKey → "NVIDIA"

Strategy underlying: "NVIDIA CORP"
  → normalizeForMatching → "NVIDIA" 
  → getMatchingKey → "NVIDIA"

→ Match corretto!

Stock: "AZ.ALPHABET INC-CL A"
  → normalizeForMatching → "ALPHABET"
  → getCanonicalKey → "ALPHABET" (via SPECIAL_ALIASES)

Strategy underlying: "GOOGLE INC. (A)"
  → normalizeForMatching → "GOOGLE"
  → getCanonicalKey → "ALPHABET" (via SPECIAL_ALIASES)

→ Match corretto!
```

