

## Snapshot affidabile per il briefing: gestione del caricamento progressivo

### Problema evidenziato
La card "Posizioni da monitorare" si popola in due fasi:
1. Prima fase: dati immediati (strategie con ticker gia risolti)
2. Seconda fase: risoluzione AI dei ticker mancanti (indicata dal badge "Risoluzione AI in corso per N strumenti...")

Se lo snapshot viene salvato subito, conterrebbe solo i dati della prima fase -- mancherebbero le posizioni con ticker non ancora risolti.

### Soluzione: salvare lo snapshot solo quando i dati sono completi

**1. Nuova tabella `monitoring_snapshot`**

- `portfolio_id` (uuid, PK)
- `sections` (jsonb) -- array di sezioni con titolo, emoji, badge e items
- `updated_at` (timestamptz)

RLS: utente puo leggere/scrivere i propri, admin e service_role possono leggere tutti.

**2. File: `src/components/derivatives/DerivativesSummaryCard.tsx`**

Aggiungere un `useEffect` che salva lo snapshot SOLO quando:
- `isFetchingMissing === false` (la risoluzione AI e terminata)
- I dati calcolati (`coveredCallsITM`, `nakedPutsITM`, ecc.) sono stabili

La condizione `isFetchingMissing` e gia disponibile come prop del componente -- e il segnale perfetto per sapere quando tutti i dati sono pronti.

```text
useEffect:
  SE isFetchingMissing === false:
    costruisci array sezioni dai dati calcolati
    upsert in monitoring_snapshot(portfolio_id, sections, updated_at)
```

Ogni sezione verra salvata come:
```json
{
  "title": "Covered Call",
  "emoji": "amber",
  "badge": "ITM",
  "items": ["AAPL $200 x1", "MSFT $420 x2"]
}
```

Le stringhe degli items saranno identiche a quelle renderizzate nei Badge della card.

**3. File: `supabase/functions/daily-briefing/index.ts`**

Rimuovere completamente `buildBriefingSections` e tutta la logica di calcolo (circa 150 righe). La funzione:
1. Legge gli utenti con notifiche attive
2. Per ogni utente, legge `monitoring_snapshot` dei suoi portfolio
3. Mappa l'emoji dal nome colore all'emoji Unicode (amber -> giallo, red -> rosso, green -> verde)
4. Formatta e invia il messaggio

Non servono piu le query a `underlying_prices`, `underlying_mappings` o `positions`.

**4. Gestione edge case: snapshot vecchio**

Il briefing verifichera che l'`updated_at` dello snapshot non sia piu vecchio di 48 ore. Se lo e, salta quel portfolio con un log di warning -- significa che l'utente non ha aperto la pagina derivati di recente e i dati potrebbero essere obsoleti.

### Flusso completo

```text
Utente apre pagina Derivati
  -> Frontend calcola sezioni (fase 1: immediata)
  -> Frontend risolve ticker mancanti (fase 2: AI)
  -> isFetchingMissing diventa false
  -> useEffect salva snapshot in DB
  
Cron alle 11:00
  -> Edge function legge snapshot dal DB
  -> Formatta e invia messaggio
```

### Vantaggi
- Il briefing mostra esattamente cio che l'utente vede nella pagina
- Nessun calcolo duplicato nell'edge function
- Lo snapshot viene salvato solo quando i dati sono completi
- Logica molto piu semplice e manutenibile
