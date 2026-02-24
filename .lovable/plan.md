

## Problema

Quando una strategia cambia tipo (es. Double Diagonal → Iron Condor), il `optionSymbol` cambia (da `DD_2024-06` a `IC_2024-06`). La logica attuale in `CallPremiumCalculatorDialog.tsx` (righe 84-96) già cerca record storici per lo stesso ticker con `optionSymbol` diverso, ma il picker storico è visibile **solo quando `!metrics`** (riga 291). Questo significa che:

1. Se la calcolatrice si apre vuota e ci sono dati storici → il picker appare (funziona)
2. Ma se l'utente ha già caricato dei dati, il picker scompare e non può più accedere ai record storici

Il problema principale potrebbe anche essere che il picker non appare affatto in alcuni casi, oppure che l'utente vuole poter ri-accedere ai dati storici in qualsiasi momento.

### Soluzione

**File:** `src/components/derivatives/CallPremiumCalculatorDialog.tsx`

1. **Rimuovere la condizione `!metrics`** dal banner del picker storico (riga 291), così il picker è sempre visibile quando ci sono dati storici disponibili, anche dopo aver caricato dei dati.

2. **Aggiungere un pulsante "Carica storico"** sempre visibile accanto all'area di upload, che permette di mostrare/nascondere il picker dei record storici in qualsiasi momento.

3. **Calcolare `historicalPremiums` sempre all'apertura**, non solo quando non c'è un match esatto. Anche quando il match esatto esiste, i dati storici di altre strategie devono essere accessibili.

Modifiche concrete:

- Riga 76-83: quando c'è un match esatto, caricare comunque i record storici (rimuovere l'`else` e calcolare sempre `historicalPremiums`)
- Riga 291: rimuovere `&& !metrics` dalla condizione, così il picker appare anche quando i dati sono già caricati
- Aggiungere un piccolo pulsante/link "Importa da storico" visibile quando `historicalPremiums.length > 0`, che toglie/mette `showHistoricalPicker`

### Dettaglio tecnico

| Riga | Modifica |
|------|----------|
| 73-98 | Calcolare sempre `historicalPremiums` (non solo nell'else del match esatto); impostare `showHistoricalPicker = false` inizialmente, lasciare all'utente la scelta di aprirlo |
| 291 | Rimuovere condizione `&& !metrics` |
| ~328 | Aggiungere pulsante "Importa da storico" tra il picker e l'upload area, visibile quando `historicalPremiums.length > 0 && !showHistoricalPicker` |

