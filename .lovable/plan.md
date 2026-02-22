

## Fix: Approccio barriera - strike sempre superiore e scadenza piu vicina

### Comportamento attuale (sbagliato)

Il nuovo strike viene calcolato come `roundStrike(S * (1 + rollUpMinDistancePct / 100))`, che puo risultare uguale o inferiore allo strike corrente. Inoltre le due azioni `roll_up_always` e `roll_up_positive` dovrebbero cercare entrambe sulla scadenza piu vicina che rispetti i requisiti.

### Comportamento corretto

Quando il sottostante si avvicina allo strike (o lo supera):
1. Calcolare il nuovo strike come il massimo tra `roundStrike(S * (1 + rollUpMinDistancePct / 100))` e `leg.strike + strikeStep` -- garantisce che sia sempre superiore allo strike corrente
2. Iterare le scadenze successive in ordine cronologico (dalla piu vicina)
3. Per `roll_up_always`: prendere la prima scadenza disponibile
4. Per `roll_up_positive`: prendere la prima scadenza dove il credito netto (nuovo premio - costo riacquisto) sia almeno `minPremiumUsd`

### Dettaglio tecnico

| File | Riga | Modifica |
|------|------|----------|
| `src/lib/backtestEngine.ts` | 384 | Dopo il calcolo di `newStrike`, aggiungere: `if (newStrike <= leg.strike) newStrike = leg.strike + strikeStep;` |

Questa singola riga risolve il problema. Il resto della logica (iterazione scadenze dalla piu vicina, check `minPremiumUsd` per `roll_up_positive`) e gia corretto.

