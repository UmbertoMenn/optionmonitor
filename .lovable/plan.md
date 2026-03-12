

## Diagnosi: Briefing mattutino non arrivato

### Causa
Tutte le chiamate `net.http_post` dal cron job vanno in **timeout a 5000ms** (default di pg_net). Le edge function impiegano più di 5 secondi (cold start + elaborazione), quindi la risposta non arriva mai. Questo riguarda **tutti** i cron job, non solo il briefing.

Ogni riga in `net._http_response` mostra:
```
error_msg: "Timeout of 5000 ms reached. Total time: 5001ms"
status_code: NULL
```

### Nota importante
Le edge function probabilmente **vengono invocate comunque** (la HTTP request parte), ma pg_net chiude la connessione dopo 5s. Se la funzione completa entro il suo wall-clock limit (150s), potrebbe funzionare lo stesso — il timeout è solo lato pg_net. Tuttavia, se la funzione dipende dalla risposta (non è il caso qui), sarebbe un problema.

Detto questo, è meglio correggere il timeout per evitare che pg_net accumuli risposte di errore inutili e per avere conferma di successo nei log.

### Soluzione
Aggiornare tutti i cron job per usare `timeout_milliseconds := 120000` (120 secondi) nella chiamata `net.http_post`. Questo richiede:

1. **Cancellare i cron job esistenti** e ricrearli con il parametro timeout:
   - `daily-portfolio-briefing`
   - `update-underlying-prices-every-5-min`
   - `update-benchmark-prices-daily`
   - `update-option-prices-every-5-min`
   - `check-derivative-alerts`

2. Eseguire via SQL (non migration, contiene dati utente-specifici):
```sql
SELECT cron.unschedule('daily-portfolio-briefing');
SELECT cron.schedule(
  'daily-portfolio-briefing',
  '0 8,9,10 * * 1-5',
  $$
  SELECT net.http_post(
    url := '...functions/v1/daily-briefing',
    headers := '...'::jsonb,
    body := concat('{"time": "', now(), '"}')::jsonb,
    timeout_milliseconds := 120000
  ) AS request_id;
  $$
);
```
   Ripetere per gli altri 4 job attivi.

3. **Pulizia** delle vecchie risposte in errore (opzionale):
```sql
DELETE FROM net._http_response WHERE status_code IS NULL;
```

### File da modificare
Nessun file di codice — solo comandi SQL eseguiti direttamente sul database.

