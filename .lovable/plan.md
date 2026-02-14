

## Fix: Allineamento riga ENI nelle Covered Call

### Problema

Il componente `OptionStratButton` restituisce `null` quando non c'e' un URL valido (riga 10 di `OptionStratButton.tsx`). Nelle griglie CSS, se un elemento figlio non viene renderizzato, la cella corrispondente non viene occupata e tutti gli elementi successivi scalano di una posizione a sinistra. Per ENI, che non ha un mapping ticker per OptionStrat, i badge P!, OTM, il menu e tutte le colonne dati risultano disallineati rispetto alle altre righe.

### Soluzione

**File: `src/components/derivatives/OptionStratButton.tsx`**

Modificare il fallback da `return null` a `return <div />` (un div vuoto che occupa la cella della griglia senza mostrare nulla). Questo garantisce che la cella della colonna venga sempre occupata, mantenendo l'allineamento di tutte le colonne successive.

```text
// Prima
if (!url) return null;

// Dopo
if (!url) return <div />;
```

### Dettagli tecnici

| File | Modifica |
|---|---|
| `src/components/derivatives/OptionStratButton.tsx` | Cambiare `return null` in `return <div />` per preservare la cella nella griglia CSS |

Modifica minima (1 riga), nessun effetto collaterale su altre sezioni.

