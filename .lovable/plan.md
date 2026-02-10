

## Fix: Cooldown non persistente a causa di duplicati nel database

### Problema
Il vincolo `UNIQUE (user_id, ticker, alert_type)` sulla tabella `alert_configs` **non impedisce i duplicati** quando `ticker` e `NULL`, perche in SQL `NULL != NULL`. Ogni salvataggio crea nuove righe invece di aggiornare quelle esistenti, e alla riapertura del dialog viene letto il primo record (quello vecchio).

Nel database di MauroG ci sono gia righe duplicate: per ogni `alert_type` esistono due record con `ticker = NULL`, uno con cooldown 240 e uno con 480.

### Soluzione

#### Migrazione SQL (un solo step)

1. **Rimuovere i duplicati**: per ogni combinazione `(user_id, alert_type)` con `ticker IS NULL`, mantenere solo la riga piu recente (quella con `updated_at` o `id` piu alto)
2. **Sostituire il vincolo unique** con un indice unico che tratta i NULL come valori uguali:

```sql
-- 1. Remove duplicates: keep only the latest row per (user_id, alert_type) where ticker IS NULL
DELETE FROM alert_configs a
USING alert_configs b
WHERE a.user_id = b.user_id
  AND a.alert_type = b.alert_type
  AND a.ticker IS NULL
  AND b.ticker IS NULL
  AND a.id < b.id;

-- 2. Drop old constraint
ALTER TABLE alert_configs
  DROP CONSTRAINT alert_configs_user_id_ticker_alert_type_key;

-- 3. Create new unique index that treats NULLs as equal
CREATE UNIQUE INDEX alert_configs_user_id_ticker_alert_type_key
  ON alert_configs (user_id, COALESCE(ticker, ''), alert_type);
```

#### Nessuna modifica al codice frontend

Il codice di upsert usa gia `onConflict: 'user_id,ticker,alert_type'` che funzionera correttamente con il nuovo indice. L'unica causa del bug era il vincolo SQL che non gestiva i NULL.

### File coinvolti
1. **Migrazione SQL** -- pulizia duplicati + nuovo indice unique con COALESCE

