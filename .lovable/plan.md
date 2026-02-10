

## Aggiornamento prezzi opzioni via Yahoo Finance + Indicatore stale

### Panoramica
Due interventi:
1. **Nuova Edge Function** `update-option-prices-cron` che aggiorna `positions.current_price` per tutti i derivati attivi usando Yahoo Finance con formula `(bid+ask)/2`
2. **Badge triangolino rosso** accanto al prezzo dell'opzione nella pagina Strategie Derivati (stesso comportamento dell'indicatore sui prezzi sottostanti)

---

### Parte 1: Edge Function per aggiornamento prezzi opzioni

**File: `supabase/functions/update-option-prices-cron/index.ts`**

Logica:
1. Recuperare tutte le posizioni derivative attive (non scadute) con `underlying`, `option_type`, `strike_price`, `expiry_date`
2. Per ogni posizione, risolvere il ticker tramite `underlying_mappings`
3. Costruire il simbolo OCC: `{TICKER}{YYMMDD}{C/P}{STRIKE*1000 padded 8 cifre}`
   - Esempio: AAPL, Call 270, scadenza 2027-12-21 -> `AAPL271217C00270000`
4. Chiamare Yahoo Finance `v8/finance/chart/{OCC_SYMBOL}` per ottenere bid/ask
5. Calcolare prezzo = `(bid + ask) / 2` (fallback su `regularMarketPrice` se bid/ask non disponibili)
6. Aggiornare `positions.current_price` e `positions.updated_at` per la posizione corrispondente

**Rate limiting** (stessa strategia dei sottostanti):
- ~234 opzioni attive
- Batch da 50, delay 200ms tra chiamate
- Pausa 2 secondi tra batch
- Timeout totale stimato: ~60 secondi

**Rimozione vecchio cron job:**
- `cron.unschedule(8)` per eliminare il job #8 non funzionante (Alpaca)
- Eliminare la funzione deployata orfana

**Nuovo cron job:**
- Schedule: `*/5 8-22 * * 1-5` (identico al cron dei sottostanti)
- Chiama la nuova edge function

**Config:**
- Aggiungere in `supabase/config.toml`:
```
[functions.update-option-prices-cron]
verify_jwt = false
```

---

### Parte 2: Badge stale price per opzioni

Per mostrare il triangolino rosso accanto al prezzo dell'opzione servono due modifiche:

**2a. Rendere disponibile `updated_at` delle posizioni nel frontend**

Il campo `positions.updated_at` esiste gia nel DB. Serve verificare che venga selezionato nella query e propagato ai componenti. Se `updated_at` e piu vecchio di 10 minuti O il mercato e chiuso, si mostra l'indicatore.

**2b. Aggiungere `StalePriceIndicator` accanto a ogni prezzo opzione**

In `src/pages/Derivatives.tsx`, accanto a ogni `formatCurrency(option.current_price || 0, 'USD')` nelle righe principali (non nei dettagli espandibili), aggiungere il triangolino con la stessa logica `shouldShowStaleIndicator`:

```typescript
// Helper per opzioni (basato su updated_at della posizione)
function shouldShowOptionStaleIndicator(option: Position, ticker?: string): boolean {
  if (!option.updated_at) return false;
  const STALE_MS = 10 * 60 * 1000;
  const isStale = Date.now() - new Date(option.updated_at).getTime() > STALE_MS;
  if (isStale) return true;
  if (ticker && !isMarketOpen(ticker)) return true;
  return false;
}
```

Righe interessate (6 tipi di riga):
- CoveredCallRow (riga ~821)
- LongPutRow (riga ~993)  
- NakedPutRow (riga ~1815)
- LeapCallRow (riga ~1902)
- IronCondorRow: i prezzi singoli delle gambe nei dettagli espandibili
- DoubleDiagonalRow: idem
- GroupedOtherStrategyRow (riga ~2047)

Il ticker per determinare il mercato si recupera da `underlyingPrices[option.underlying]?.ticker`.

**Aggiornamento tooltip header:** il testo "Prezzi Opzioni: valori statici caricati dal file Excel" (riga ~229) diventa "Prezzi Opzioni (PO): aggiornati ogni 5 minuti con (bid+ask)/2 da Yahoo Finance".

---

### Riepilogo modifiche

| File | Modifica |
|------|----------|
| `supabase/functions/update-option-prices-cron/index.ts` | Nuova edge function: Yahoo Finance OCC, (bid+ask)/2 |
| `supabase/config.toml` | Aggiungere sezione `[functions.update-option-prices-cron]` |
| DB migration | Rimuovere cron job #8, creare nuovo cron job |
| `src/pages/Derivatives.tsx` | Aggiungere `StalePriceIndicator` accanto ai prezzi opzioni in tutte le righe, aggiornare tooltip header |

