

## Fix: Matching fallito per "AMAZON.COM.INC" vs "AMAZON COM INC"

### Problema

La funzione `normalizeForMatching` in `src/lib/derivativeStrategies.ts` contiene una regex per collassare abbreviazioni puntate (es. `J.P.` -> `JP`):

```text
.replace(/([A-Z])\.([A-Z])/g, '$1$2')
```

Quando applicata a `AMAZON.COM.INC`, questa regex rimuove i punti e fonde i token in modo errato, producendo un risultato che non corrisponde piu' al nome del titolo `AMAZON COM INC`.

Di conseguenza:
- La CALL 270 JUN/27 venduta NON viene riconosciuta come Covered Call (Step 1 fallisce)
- La PUT 180 DEC/27 comprata NON viene riconosciuta come Protezione (Step 2 fallisce per mancanza di stock match)
- Entrambe finiscono in "Altre Strategie"

### Soluzione

Due interventi complementari:

#### 1. Fix `normalizeForMatching` - Gestire i punti come separatori PRIMA del collapse delle abbreviazioni

La regex per le abbreviazioni puntate deve applicarsi solo a pattern come `J.P.` (1-2 lettere seguite da punto), non a parole complete come `AMAZON.COM`. Limitare il collapse a sequenze di singole lettere puntate.

```text
// Prima (problematico):
.replace(/([A-Z])\.([A-Z])/g, '$1$2')

// Dopo (corretto): collassa solo abbreviazioni brevi (1-2 lettere)
// Prima sostituire i punti tra parole lunghe con spazi
.replace(/([A-Z]{3,})\.([A-Z])/g, '$1 $2')
.replace(/([A-Z])\.([A-Z]{3,})/g, '$1 $2')
// Poi collassare le abbreviazioni brevi restanti
.replace(/([A-Z])\.([A-Z])/g, '$1$2')
```

Con questo fix:
- `AMAZON.COM.INC` -> `AMAZON COM INC` -> (dopo rimozione suffissi) `AMAZON COM`
- `J.P.MORGAN` -> `JPMORGAN` (funziona ancora correttamente)

#### 2. Aggiungere AMAZON a SPECIAL_ALIASES come safety net

```text
AMAZON: ['AMAZON', 'AMZN', 'AMAZON COM', 'AMAZON.COM', 'AMAZON.COM.INC'],
```

### File modificati

| File | Modifica |
|------|----------|
| `src/lib/derivativeStrategies.ts` | Fix regex in `normalizeForMatching` + aggiunta AMAZON in SPECIAL_ALIASES |

### Risultato

- La CALL 270 JUN/27 venduta verra' correttamente classificata come **Covered Call**
- La PUT 180 DEC/27 comprata verra' correttamente classificata come **Protezione**
- Il fix e' generico e risolve anche eventuali altri nomi con punti (es. futuri titoli con formato simile)
- La regex per abbreviazioni brevi come `J.P.` continua a funzionare

