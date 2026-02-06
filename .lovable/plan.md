
# Piano: Correzione Validazione Ticker Diretti

## Problema Identificato

Quando l'utente inserisce un ticker diretto come "AAPL" nel tab Prezzo e clicca "Verifica", il sistema restituisce "Ticker non trovato" perché:

1. L'edge function `fetch-underlying-prices` e progettata per risolvere nomi company (es. "NVIDIA CORP") in ticker
2. La logica di ricerca cerca nelle chiavi di `SPECIAL_MAPPINGS` (es. "APPLE", "NVIDIA") ma non trova "AAPL"
3. Il pattern matching sulla linea 150-153 cerca ticker nel testo ma controlla solo se esiste gia in `SPECIAL_MAPPINGS`
4. L'AI inference viene chiamata ma potrebbe non funzionare correttamente per input che sono gia ticker

## Soluzione

Aggiungere un nuovo Step 0 nella logica di risoluzione che verifica se l'input sembra gia un ticker valido (formato breve, 1-5 caratteri maiuscoli) e in tal caso lo valida direttamente su Yahoo Finance.

## Modifiche Tecniche

### File: `supabase/functions/fetch-underlying-prices/index.ts`

Aggiungere la seguente logica prima dello Step 1 (intorno alla linea 363):

```typescript
// Step 0: Check if input looks like a ticker (1-5 uppercase letters/hyphen)
// If so, validate directly on Yahoo Finance
const tickerPattern = /^[A-Z]{1,5}(-[A-Z])?$/;
if (tickerPattern.test(underlying.toUpperCase())) {
  const directTicker = underlying.toUpperCase();
  console.log(`Input "${underlying}" looks like a ticker, validating directly...`);
  
  const isValid = await validateTicker(directTicker);
  if (isValid) {
    ticker = directTicker;
    console.log(`Direct ticker "${directTicker}" validated successfully`);
  }
}
```

### Posizione nel flusso

```text
for (const underlying of underlyings) {
  let ticker: string | null = null;
  
  // NEW: Step 0 - Direct ticker validation
  if (input looks like ticker) {
    validate on Yahoo Finance
    if valid -> use it
  }
  
  // Step 1: Check underlying_mappings cache
  if (!ticker) { ... }
  
  // Step 2: Try static mappings
  if (!ticker) { ... }
  
  // Step 3: Try AI inference
  if (!ticker) { ... }
  
  // Rest of the logic...
}
```

### Dettaglio della modifica

| Azione | Descrizione |
|--------|-------------|
| Aggiungere pattern regex | `/^[A-Z]{1,5}(-[A-Z])?$/` per riconoscere ticker standard (es. AAPL, BRK-B) |
| Validazione diretta | Se l'input matcha il pattern, chiamare `validateTicker()` (gia esistente) |
| Log diagnostico | Aggiungere log per tracciare il flusso |
| Fallback | Se la validazione diretta fallisce, proseguire con il flusso normale |

## Risultato Atteso

Dopo la modifica:

| Input | Prima | Dopo |
|-------|-------|------|
| AAPL | "Ticker non trovato" | Validato, prezzo restituito |
| LEU | "Ticker non trovato" | Validato, prezzo restituito |
| NVIDIA CORP | Funziona | Funziona (invariato) |
| BRK-B | "Ticker non trovato" | Validato, prezzo restituito |
| xyz123 | Errore | Prosegue con flusso normale |

## File da Modificare

| File | Modifica |
|------|----------|
| `supabase/functions/fetch-underlying-prices/index.ts` | Aggiungere Step 0 con validazione diretta ticker |
