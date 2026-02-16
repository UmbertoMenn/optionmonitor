

## Fix: Allineare la normalizzazione tra hook e Edge Function

### Problema

La Edge Function `fetch-underlying-prices` salva i mapping con nomi normalizzati che rimuovono suffissi corporate (`INC`, `CORP`, `LTD`, `LLC`, `PLC`, `CO`, `THE`). Ma l'hook `useUnderlyingMappings` usa una normalizzazione diversa (solo lowercase + rimuove caratteri speciali) per confrontare i candidati con i mapping esistenti.

Esempio concreto dai log:
- Posizione nel DB: `"SOFI TECHNOLOGIES INC"`
- Mapping salvato dalla Edge Function: `"SOFI TECHNOLOGIES"` (senza INC)
- Normalizzazione hook: `"sofitechnologiesinc"` vs `"sofitechnologies"` -- **non corrispondono**

Questo succede per tutti i 10 ticker risolti: la Edge Function li salva correttamente, ma l'hook non li riconosce come risolti perche' la funzione di normalizzazione e' diversa.

### Soluzione

**File: `src/hooks/useUnderlyingMappings.ts`**

Aggiornare la funzione `normalize` nella `unresolvedQuery` per replicare la stessa logica della Edge Function:

```text
// PRIMA (attuale):
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

// DOPO (allineata con Edge Function):
const normalize = (s: string) =>
  s.toUpperCase()
    .replace(/[.,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\bINC\b/g, '')
    .replace(/\bCORP\b/g, '')
    .replace(/\bLTD\b/g, '')
    .replace(/\bLLC\b/g, '')
    .replace(/\bPLC\b/g, '')
    .replace(/\bCO\b/g, '')
    .replace(/\bTHE\b/g, '')
    .replace(/[^A-Z0-9]/g, '')
    .trim();
```

Questo assicura che `"SOFI TECHNOLOGIES INC"` e `"SOFI TECHNOLOGIES"` producano lo stesso valore normalizzato (`"SOFITECHNOLOGIES"`), permettendo al confronto di funzionare correttamente.

### File da modificare

| File | Modifica |
|---|---|
| `src/hooks/useUnderlyingMappings.ts` | Aggiornare la funzione `normalize` (riga 80) per rimuovere anche i suffissi corporate (INC, CORP, LTD, LLC, PLC, CO, THE) prima del confronto |

### Risultato atteso

- Dopo aver cliccato "Risolvi Automaticamente", i ticker risolti scompaiono dalla lista "Non Risolti"
- I mapping salvati dalla Edge Function vengono riconosciuti correttamente anche se il nome nel DB contiene suffissi come INC, CORP, ecc.
