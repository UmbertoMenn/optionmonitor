## Stato attuale (verificato sul DB live)

- Tabella `public.put_roll_flags` → **non esiste**
- Enum `alert_type` → contiene 18 valori, **mancano** `action_put_roll_up_otm` e `distance_put_roll_up`

Le due migration SQL sono presenti nel repo (`supabase/migrations/20260623115900_*` e `20260623120000_*`) ma non sono mai state eseguite. Conferma: il **Publish di Lovable non applica file SQL** arrivati via push esterno — deploya solo frontend ed edge functions. Vanno eseguite esplicitamente.

## Piano

Eseguire le due migration sul Lovable Cloud, in due step separati (obbligatorio: `ALTER TYPE ADD VALUE` non può girare nella stessa transazione che poi usa quei valori).

### Step 1 — Estendere l'enum `alert_type`
```sql
ALTER TYPE alert_type ADD VALUE IF NOT EXISTS 'action_put_roll_up_otm';
ALTER TYPE alert_type ADD VALUE IF NOT EXISTS 'distance_put_roll_up';
```

### Step 2 — Creare `put_roll_flags` con RLS + GRANT
Stessa struttura del file nel repo (tabella keyed by `strategy_key`, UNIQUE per `portfolio_id+strategy_key`, 4 policy RLS scoped all'`auth.uid()` via `portfolios`, indice su `portfolio_id`), con due correzioni necessarie per Lovable Cloud che mancavano nel file originale di Claude:

- Aggiungo i `GRANT` espliciti (obbligatori: senza, PostgREST risponde "permission denied" anche con RLS attiva):
  ```sql
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.put_roll_flags TO authenticated;
  GRANT ALL ON public.put_roll_flags TO service_role;
  ```
  Niente grant ad `anon` (tutte le policy sono scoped a `auth.uid()`).
- Aggiungo trigger `update_updated_at_column` per mantenere `updated_at` (coerente col resto delle tue tabelle).

## Verifica post-migrazione

1. `SELECT to_regclass('public.put_roll_flags')` → deve ritornare il nome tabella.
2. `enum_range(NULL::alert_type)` → deve includere i due nuovi valori.
3. Tagga una PUT come "roll-up" dalla UI e controlla che la riga appaia in `put_roll_flags` e che `check-alerts` emetta i nuovi tipi senza errori enum.

## Cosa NON tocco

Solo database. Nessuna modifica a frontend, edge functions, o codice TS. I file in `supabase/migrations/` resteranno come storico nel repo (non li rimuovo).
