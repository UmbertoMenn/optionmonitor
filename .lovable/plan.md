

## Trasformare "Alla scadenza, barriera nuova call" in terza opzione radio

### Modifica

Il blocco "Alla scadenza, barriera nuova call" (attualmente sempre visibile, senza pallino) diventa una terza opzione radio nella sezione "Cosa fai?":

```
Cosa fai?
  (o) Rollo su scadenza successiva con strike piu alto (anche se debito)
      Distanza min strike [__]%
  (o) Rollo solo se la differenza e positiva di almeno: [__] USD
      Distanza min strike [__]%
  (o) Non faccio nulla ed alla scadenza rivendo una nuova call con barriera: [__]%
```

### File modificati

| File | Modifica |
|------|----------|
| `src/lib/adjustmentRules.ts` | Aggiungere `'do_nothing'` al tipo `action` di `ApproachRule` (riga 7): `'roll_up_always' \| 'roll_up_positive' \| 'do_nothing'` |
| `src/components/simulator/AdjustmentRuleEditor.tsx` | Rimuovere il blocco "always visible" (righe 117-127) e aggiungere una terza opzione `RadioGroupItem` con value `do_nothing`, label "Non faccio nulla ed alla scadenza rivendo una nuova call con barriera:", e input `newCallBarrierPct` visibile solo quando selezionata |
| `src/lib/backtestEngine.ts` | Aggiungere gestione del caso `do_nothing` in `executeApproachRule`: se l'azione e `do_nothing`, non fare nessun roll (return null), la leg scadra naturalmente e verra venduta una nuova call con barriera `newCallBarrierPct` alla scadenza |

