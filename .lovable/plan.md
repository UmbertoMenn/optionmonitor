

## Fix definitivo: la pagina Derivati deve rispecchiare SOLO le configurazioni salvate

### Il problema reale

Hai ragione. Il flusso dovrebbe essere banale:
1. Leggi le config dal DB (3 per GOOGLE nel tuo portfolio)
2. Per ogni config, trova le posizioni corrispondenti e arricchiscile con dati live
3. Mostra 1 strategia per config. Fine.

Ho verificato il DB: il tuo portfolio ha esattamente 3 config GOOGLE (sort_order 23, 55, 56). La logica quantity-aware in Step 0.5 sembra corretta sulla carta, ma il problema è che il codice ha troppi livelli di indirezione e punti di rottura. Ho individuato i problemi concreti:

**Problema 1 — `configCoveredIds` usa il vecchio matching 1:1 (righe 206-218)**
La pre-computazione usa `filterBySignatures` che è 1:1, ignorando `quantity_abs`. Questo può "bruciare" l'intera riga -2 per la prima config, lasciando la seconda senza match nel precompute. Anche se Step 0.5 è quantity-aware, il precompute potrebbe avere effetti collaterali.

**Problema 2 — `configOnly` return non distingue per config**
Il return a riga 532 restituisce array piatti (`coveredCalls`, `nakedPuts`, ecc.) senza alcun legame con la config di origine. Se due covered call dello stesso underlying finiscono nello stesso array, la pagina non sa che vengono da 2 config diverse. Non c'è modo di garantire 1:1.

**Problema 3 — Il wizard `restoreFromConfigs` non usa lo stesso codice della pagina**
Ha una sua logica di matching separata. Se il restore fallisce, raggruppa tutto insieme.

### La soluzione

Invertire completamente l'approccio nel percorso `configOnly`:

**Invece di** far categorizzare le posizioni e poi provare a mapparle alle config,
**fare**: iterare sulle config, e per ognuna costruire il risultato renderizzabile.

#### File 1: `src/lib/derivativeStrategies.ts`

Riscrivere il blocco `configOnly` (prima del return a riga 532) per produrre un risultato **indicizzato per config**:

- Aggiungere un campo `resolvedConfigs` al tipo `DerivativeCategories`: una lista ordinata dove ogni elemento corrisponde a una config salvata e contiene:
  - `configId`, `strategyType`, `underlying`, `sortOrder`
  - `matchedPositions`: le posizioni virtuali (già quantity-aware) assegnate
  - `linkedStock`: il titolo collegato
  - `isSynthetic`: flag
  - `status`: 'matched' | 'partial' | 'unmatched'

- Nel percorso `configOnly`, il return include `resolvedConfigs` e gli array categorizzati come oggi (per retrocompatibilità con risk/equity/snapshot).

- Eliminare `configCoveredIds` precompute con `filterBySignatures` — non serve più nel percorso configOnly, Step 0.5 è già quantity-aware.

#### File 2: `src/pages/Derivatives.tsx`

Usare `resolvedConfigs` come fonte primaria per il rendering:

- Per ogni `resolvedConfig`, in base al suo `strategyType`, renderizzare la sezione corretta (covered call, naked put, other, ecc.)
- NON più iterare su `categories.coveredCalls` / `categories.nakedPuts` separatamente — iterare su `resolvedConfigs` e distribuire nelle sezioni
- Questo garantisce: **1 config = 1 card visibile**, sempre

#### File 3: `src/components/derivatives/StrategyConfigWizard.tsx`

`restoreFromConfigs` è già quasi corretto — la logica di split automatico e matching per firma funziona. Unico fix: assicurarsi che il matching usi esattamente la stessa logica di `categorizeDerivatives` Step 0.5 (stessa funzione `getCanonicalKey`, stesso ordine di consumo).

#### File 4: `src/components/derivatives/StrategyReconciliationDialog.tsx`

Quando risalva, includere TUTTE le config del portfolio (non solo quelle del sottostante coinvolto) per evitare di cancellare sorelle.

### Dettaglio tecnico: nuovo tipo `ResolvedConfig`

```text
interface ResolvedConfig {
  configId: string;
  strategyType: string;
  underlying: string;
  sortOrder: number;
  isSynthetic: boolean;
  linkedStock: Position | null;
  matchedPositions: Position[];  // virtual, quantity-scaled
  status: 'matched' | 'partial' | 'unmatched';
}
```

### Cosa NON cambia
- Il DB è già corretto (3 config per GOOGLE)
- La migrazione precedente (rimozione vincolo UNIQUE) è già applicata
- Il salvataggio `upsertBatch` funziona correttamente
- Gli array piatti (`coveredCalls`, `nakedPuts`, ecc.) restano per retrocompatibilità con risk analyzer, equity exposure, snapshot

### Risultato atteso
- 3 config GOOGLE → 3 strategie visibili, sempre
- "Riconfigura strategie" → 3 card separate nel wizard
- Nessuna euristica, nessun raggruppamento, nessuna magia

