

## Avvisi esattamente durante orario mercato USA

### Approccio

`pg_cron` lavora in UTC e non supporta fusi orari dinamici, quindi non puo sapere se siamo in ora legale (EDT) o solare (EST). La soluzione intelligente: **aggiungere un controllo di orario preciso all'inizio della Edge Function `check-alerts`** che calcola se il mercato USA e realmente aperto, considerando il DST americano. Se il mercato e chiuso, la funzione esce immediatamente senza fare nulla.

Il cron job resta con un intervallo ampio (che copre entrambi i periodi DST), ma la funzione stessa fa da "guardiano" e si auto-regola con precisione al minuto.

### Come funziona il DST americano

- **EDT (estate):** seconda domenica di marzo - prima domenica di novembre, UTC-4
- **EST (inverno):** prima domenica di novembre - seconda domenica di marzo, UTC-5
- Mercato NYSE: 9:30-16:00 Eastern Time (fisso, non cambia con DST)

### Dettaglio tecnico

**1. Cron job (jobid 7):** cambiare schedule da `*/5 8-22 * * 1-5` a `*/5 13-21 * * 1-5`

Questo copre l'unione dei due intervalli UTC possibili (13:30-20:00 EDT e 14:30-21:00 EST) con margine minimo, riducendo le chiamate inutili.

**2. Edge Function `check-alerts/index.ts`:** aggiungere all'inizio (dopo il check OPTIONS) una funzione `isUSMarketOpen()` che:

```
function isUSMarketOpen(): boolean {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;

  // Calcola offset Eastern Time (EDT o EST)
  const year = now.getUTCFullYear();
  // Seconda domenica di marzo
  const marchFirst = new Date(Date.UTC(year, 2, 1));
  const marchSecondSunday = 14 - marchFirst.getUTCDay();
  const dstStart = new Date(Date.UTC(year, 2, marchSecondSunday, 7)); // 2:00 ET = 7:00 UTC

  // Prima domenica di novembre
  const novFirst = new Date(Date.UTC(year, 10, 1));
  const novFirstSunday = novFirst.getUTCDay() === 0 ? 1 : 8 - novFirst.getUTCDay();
  const dstEnd = new Date(Date.UTC(year, 10, novFirstSunday, 6)); // 2:00 ET = 6:00 UTC

  const isDST = now >= dstStart && now < dstEnd;
  const etOffset = isDST ? -4 : -5;

  // Ora corrente in Eastern Time
  const etHour = now.getUTCHours() + etOffset;
  const etMinutes = now.getUTCMinutes();
  const etTime = etHour * 60 + etMinutes;

  // NYSE: 9:30 - 16:00 ET
  return etTime >= 570 && etTime < 960; // 9*60+30=570, 16*60=960
}
```

Poi, subito dopo la creazione del client Supabase:

```
if (!isUSMarketOpen()) {
  console.log('US market is closed, skipping alert check');
  return new Response(JSON.stringify({ skipped: true, reason: 'market_closed' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

### Risultato

- Il cron gira ogni 5 minuti dalle 13 alle 21 UTC (copertura ampia)
- La funzione verifica l'orario esatto del mercato USA considerando il DST e esce in millisecondi se il mercato e chiuso
- Nessun avviso viene mai generato fuori orario di mercato
- Zero impatto sulla logica degli avvisi esistente
- Il cambio ora italiano (CET/CEST) e irrilevante perche tutto lavora in UTC ed Eastern Time

### Cosa cambia
- Schedule cron job 7: da `*/5 8-22` a `*/5 13-21`
- `check-alerts/index.ts`: aggiunta funzione `isUSMarketOpen()` e early return

### Cosa NON cambia
- Frequenza: resta ogni 5 minuti
- Logica avvisi: invariata
- Solo giorni lavorativi (lun-ven)
- Nessuna modifica ad altre Edge Function o al frontend

