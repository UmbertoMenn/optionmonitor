

## Fix: Risoluzione ticker europei per opzioni EUREX

### Stato attuale

- ENI e' gia' mappata correttamente a `ENI.MI` nei `SPECIAL_MAPPINGS` (riga 82-83) -- nessun conflitto
- Il problema e' che NON esiste un sistema di rilevamento dell'exchange: il prompt AI chiede solo "US stock ticker", quindi per qualsiasi azienda europea non presente in `SPECIAL_MAPPINGS`, il sistema risolve verso ADR americane con prezzi sbagliati
- Nel DB ci sono 4 mapping errati (MBGYY, DHLGY) e 2 prezzi errati in `underlying_prices`

### Modifiche

**File: `supabase/functions/fetch-underlying-prices/index.ts`**

#### 1. Aggiungere funzione `detectExchange()`

Rileva il prefisso "EUREX" (e potenzialmente altri exchange EU come IDEM) dalla stringa underlying per determinare se il titolo e' europeo.

#### 2. Aggiungere funzione `cleanEurexUnderlying()`

Estrae il nome pulito della societa' dalla stringa EUREX:
- Input: `"EUREX, MERCEDES-BENZ GROUP, DEC26, 58, CALL, PHYSICAL, AMER, SINGLE STOCK"`
- Output: `"MERCEDES-BENZ GROUP"`

Nota: la normalizzazione rimuove virgole/punti e le converte in spazi, quindi la stringa EUREX completa viene gia' normalizzata. La funzione deve operare PRIMA della normalizzazione.

#### 3. Aggiungere SPECIAL_MAPPINGS europei

```
'MERCEDES-BENZ GROUP': 'MBG.DE',
'MERCEDES-BENZ': 'MBG.DE',
'MERCEDES BENZ': 'MBG.DE',
'MERCEDES-BENZ GROUP AG': 'MBG.DE',
'DEUTSCHE POST': 'DHL.DE',
'DEUTSCHE POST AG': 'DHL.DE',
'DHL GROUP': 'DHL.DE',
'DHL': 'DHL.DE',
```

ENI resta invariata (gia' presente come `ENI.MI`).

#### 4. Modificare il prompt AI per supportare ticker europei

Quando l'exchange e' EU, il prompt diventa:
- "What is the Yahoo Finance ticker for [company] on its primary European exchange? Include the suffix (e.g., .DE, .MI, .PA, .AS, .L)"

Quando e' US (o sconosciuto), resta il prompt attuale.

#### 5. Aggiornare la validazione del ticker AI

Il regex attuale `/^[A-Z-]+$/` con max 5 caratteri non accetta ticker con punto (es. `MBG.DE`). Va esteso per accettare il formato `TICKER.XX`.

#### 6. Aggiornare lo Step 0 (validazione diretta)

Anche lo step 0 (che controlla se l'input sembra un ticker) deve accettare il formato europeo `XXX.YY`.

### Modifiche al flusso principale

Nel loop `for (const underlying of underlyings)`:
1. Aggiungere uno step iniziale che chiama `detectExchange()` e `cleanEurexUnderlying()` sulla stringa originale
2. Passare il nome pulito (non la stringa EUREX completa) ai passi successivi di risoluzione
3. Passare l'exchange hint alla funzione `inferTickerWithAI()`

### Correzioni database

Aggiornare i mapping errati e rimuovere i prezzi ADR:

```sql
UPDATE underlying_mappings SET ticker = 'MBG.DE' WHERE ticker = 'MBGYY';
UPDATE underlying_mappings SET ticker = 'DHL.DE' WHERE ticker = 'DHLGY';
DELETE FROM underlying_prices WHERE ticker IN ('MBGYY', 'DHLGY');
```

### File modificati

| File | Modifica |
|------|----------|
| `supabase/functions/fetch-underlying-prices/index.ts` | Aggiungere detectExchange, cleanEurexUnderlying, mappature EU, prompt AI condizionale, regex ticker esteso |
| Database (migration) | Fix mapping MBGYY->MBG.DE, DHLGY->DHL.DE, rimozione prezzi errati |

