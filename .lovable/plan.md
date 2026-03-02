

## Diagnosi

Ho investigato a fondo i dati e il codice. Ecco i problemi trovati:

### 1. AI inference genera ticker ADR americani per azioni europee

Il sistema `fetch-underlying-prices` chiede all'AI "What is the US stock ticker for..." quando non rileva un exchange europeo (EUREX/IDEM). Ma azioni come TELECOM ITALIA, WEBUILD, SIKA non passano da EUREX — sono stock puri. Risultato: l'AI restituisce gli ADR americani sbagliati.

Mappature errate nel database:
| Sottostante | Ticker errato | Ticker corretto |
|---|---|---|
| TELECOM ITALIA | TIIAY (ADR US) | TIT.MI |
| WEBUILD | WBD (Warner Bros!) | WBD.MI |
| SIKA AG-BR | SXYAY (ADR US) | SIKA.SW |
| ROCHE HOLDING | RHHBY (ADR US) | ROG.SW |
| NOVARTIS AG-REG SHS | NOVN (SIX no suffix) | NOVN.SW |
| SOL | SOL (crypto/solar US) | SOL.MI |

### 2. "Call da rivendere" nel briefing: key mismatch stock vs strategia

Nel codice `daily-briefing/index.ts`, sezione "Call da rivendere" (riga 590):
- **Stock**: risolve via `resolveStockTicker` → ticker canonico (es. "NVDA")
- **Strategia**: usa `s.ticker || getMatchingKey(s.underlying)` → potrebbe non matchare

Se `resolveStockTicker` fallisce per uno stock (nessun mapping), il fallback `getMatchingKey` restituisce il nome normalizzato (es. "NVIDIA"), ma la strategia ha `s.ticker = "NVDA"`. **Non matchano → la covered call non viene contata → falso "call da rivendere"**.

### 3. Mancano SPECIAL_MAPPINGS per azioni italiane/svizzere

`fetch-underlying-prices` ha mappature statiche per azioni EU comuni (SAP, FERRARI, ENI...) ma mancano TELECOM ITALIA, WEBUILD, SOL, SIKA, NOVARTIS, ROCHE, UBS.

---

## Piano di implementazione

### File 1: `supabase/functions/fetch-underlying-prices/index.ts`

Aggiungere a SPECIAL_MAPPINGS:
```
'TELECOM ITALIA': 'TIT.MI',
'TELECOM ITALIA SPA': 'TIT.MI',
'WEBUILD': 'WBD.MI',
'WEBUILD SPA': 'WBD.MI',
'SIKA': 'SIKA.SW',
'SIKA AG': 'SIKA.SW',
'SIKA AG-BR': 'SIKA.SW',
'NOVARTIS': 'NOVN.SW',
'NOVARTIS AG': 'NOVN.SW',
'NOVARTIS AG-REG SHS': 'NOVN.SW',
'ROCHE': 'ROG.SW',
'ROCHE HOLDING': 'ROG.SW',
'ROCHE HOLDING AG': 'ROG.SW',
'UBS': 'UBSG.SW',
'UBS GROUP': 'UBSG.SW',
'UBS GROUP AG': 'UBSG.SW',
```

### File 2: `supabase/functions/daily-briefing/index.ts`

Nella sezione "Call da rivendere" (riga 590), allineare la risoluzione della chiave strategia con quella dello stock:
```typescript
// PRIMA (bug):
const sKey = s.ticker || getMatchingKey(s.underlying);

// DOPO (fix):
const sKey = resolveStockTicker(s.underlying, directMappings, normalizedMappings)
  || s.ticker || getMatchingKey(s.underlying);
```

### File 3: Migrazione SQL

Correggere le mappature errate esistenti in `underlying_mappings`:
```sql
UPDATE underlying_mappings SET ticker = 'TIT.MI' WHERE underlying = 'TELECOM ITALIA' AND ticker = 'TIIAY';
UPDATE underlying_mappings SET ticker = 'WBD.MI' WHERE underlying = 'WEBUILD' AND ticker = 'WBD';
UPDATE underlying_mappings SET ticker = 'SIKA.SW' WHERE underlying = 'SIKA AG-BR' AND ticker = 'SXYAY';
UPDATE underlying_mappings SET ticker = 'ROG.SW' WHERE underlying ILIKE '%ROCHE HOLDING%' AND ticker = 'RHHBY';
UPDATE underlying_mappings SET ticker = 'NOVN.SW' WHERE underlying ILIKE '%NOVARTIS%' AND ticker = 'NOVN';
UPDATE underlying_mappings SET ticker = 'SOL.MI' WHERE underlying = 'SOL' AND ticker = 'SOL';
```

Aggiornare anche `strategy_cache` per le strategie CamilloDC con ticker errati:
```sql
UPDATE strategy_cache SET ticker = 'TIT.MI' WHERE ticker = 'TIIAY';
UPDATE strategy_cache SET ticker = 'WBD.MI' WHERE ticker = 'WBD' AND underlying = 'WEBUILD';
UPDATE strategy_cache SET ticker = 'SIKA.SW' WHERE ticker = 'SXYAY';
```

E aggiornare `underlying_prices` per i prezzi già in cache:
```sql
DELETE FROM underlying_prices WHERE ticker IN ('TIIAY', 'SXYAY', 'RHHBY');
UPDATE underlying_prices SET ticker = 'WBD.MI' WHERE ticker = 'WBD';
```

### Riepilogo impatto

- **CamilloDC**: TELECOM ITALIA userà TIT.MI (EUR), WEBUILD userà WBD.MI (EUR), SIKA userà SIKA.SW (CHF). Niente più TIIAY/SXYAY/WBD nel briefing
- **MaxB**: "Call da rivendere NVIDIA" sparirà perché la key resolution sarà coerente
- **Briefing**: le posizioni monitorate corrisponderanno correttamente grazie alla risoluzione unificata

