

# Piano: Sospendere Temporaneamente il Cron Job di Aggiornamento Prezzi

## Situazione Attuale

Il cron job e' configurato cosi':

| Parametro | Valore |
|-----------|--------|
| Job ID | 2 |
| Schedule | `*/5 8-22 * * 1-5` (ogni 5 min, lun-ven, 08-22 UTC) |
| Active | `true` |
| Target | `update-prices-cron` edge function |

## Opzioni per Sospendere

### Opzione 1: Disattivare il Job (Consigliata)

Usare `cron.alter_job()` per impostare `active = false`. Il job rimane configurato ma non viene eseguito.

```sql
SELECT cron.alter_job(2, active := false);
```

**Vantaggi:**
- Semplice e reversibile
- Mantiene tutta la configurazione (schedule, comando)
- Per riattivare basta: `SELECT cron.alter_job(2, active := true);`

### Opzione 2: Eliminare e Ricreare (Non consigliata)

Eliminare il job con `cron.unschedule()` e salvare la configurazione da qualche parte per ricrearlo dopo.

---

## Piano di Esecuzione

### 1. Eseguire il Comando di Sospensione

```sql
SELECT cron.alter_job(2, active := false);
```

### 2. Documentare la Configurazione per il Ripristino

Salvero' in un commento nel codice o nella documentazione:

```sql
-- CRON JOB SOSPESO - Per riattivare:
-- SELECT cron.alter_job(2, active := true);
--
-- Configurazione originale:
-- Schedule: */5 8-22 * * 1-5 (ogni 5 min, lun-ven, 08-22 UTC / 09-23 IT)
-- Target: update-prices-cron edge function
-- Descrizione: Aggiorna prezzi delle azioni (asset_type = 'stock')
```

### 3. Verifica

Dopo la sospensione, controllero' che il job sia effettivamente disattivato:

```sql
SELECT jobid, schedule, active FROM cron.job WHERE jobid = 2;
```

---

## Come Ripristinare in Futuro

Quando vorrai riattivare l'aggiornamento automatico dei prezzi:

```sql
SELECT cron.alter_job(2, active := true);
```

Oppure, se vuoi modificare lo schedule al momento del ripristino:

```sql
SELECT cron.alter_job(
  2, 
  active := true,
  schedule := '*/5 8-22 * * 1-5'  -- modifica se necessario
);
```

---

## Riepilogo

| Azione | Comando |
|--------|---------|
| **Sospendere** | `SELECT cron.alter_job(2, active := false);` |
| **Riattivare** | `SELECT cron.alter_job(2, active := true);` |
| **Verificare stato** | `SELECT jobid, active FROM cron.job WHERE jobid = 2;` |

Il codice della edge function `update-prices-cron` rimarra' intatto e pronto all'uso quando riattiverai il job.

