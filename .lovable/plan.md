## Modifiche

### 1. `supabase/functions/update-beta-cron/index.ts`
Aggiungere fallback GuruFocus quando Yahoo non restituisce il Beta:
- Funzione `guruFocusBeta(ticker)` (stessa regex già usata in `fetch-ticker-fundamentals`).
- Nel loop, se `beta` da Yahoo è `null`/non finito → chiamata a GuruFocus. Se trovato, salvato con `beta_source = "GuruFocus"`.
- Lo sleep adattivo già presente copre anche le chiamate GuruFocus (stessa cadenza).
- Se nemmeno GuruFocus risponde, il ticker viene comunque aggiornato con gli altri campi (RV, prezzo, nome, currency, risk_free) — non si perde il run.

### 2. Schedulazione cron — passaggio a settimanale

Riprogrammare entrambi i job via `pg_cron` (insert SQL, non migration, per non rieseguirsi sui remix):

- `update-erp-weekly` → ogni lunedì alle 02:00 UTC (`0 2 * * 1`)
- `update-beta-weekly` → ogni lunedì alle 03:00 UTC (`0 3 * * 1`)

Sequenza SQL:
1. `cron.unschedule('update-erp-daily')` (vecchio job giornaliero)
2. `cron.unschedule('update-beta-monthly')` (vecchio job mensile)
3. `cron.schedule('update-erp-weekly', '0 2 * * 1', …)` con `net.http_post` verso `/functions/v1/update-erp-cron`
4. `cron.schedule('update-beta-weekly', '0 3 * * 1', …)` con `net.http_post` verso `/functions/v1/update-beta-cron`

### 3. Verifica
- Query `cron.job` per confermare che restino solo i due job settimanali.
- Trigger manuale di `update-beta-cron` su un ticker noto senza beta Yahoo per verificare il fallback GuruFocus.

## File toccati
- edit `supabase/functions/update-beta-cron/index.ts`
- insert SQL (non-migration) per riprogrammare i due cron
