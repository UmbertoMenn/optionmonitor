

## Fix: Mostrare ticker azioni nella gestione avvisi prezzo + cron per aggiornamento

### Problema

Le posizioni azionarie nel database hanno `ticker: null` - solo la `description` (es. "AZ.PAYPAL HOLDINGS INC") identifica il titolo. Il codice attuale in `extractUniqueTickers` filtra con `p.ticker` che e' sempre null per le azioni, quindi nessun badge viene mostrato.

### Soluzione (2 parti)

#### Parte 1: Mostrare i ticker delle azioni nel tab Prezzo

**File: `src/components/derivatives/AlertSettingsDialog.tsx`**

1. Importare `useUnderlyingMappings` per accedere alla tabella `underlying_mappings` (che contiene la risoluzione nome→ticker gia' popolata dal sistema di derivati e dal cron)
2. Modificare `extractUniqueTickers` per accettare anche `allMappings` come parametro
3. Per ogni posizione stock con `ticker === null`, normalizzare la `description` (rimuovere prefisso "AZ.", suffissi "INC", ecc.) e cercare una corrispondenza in `underlying_mappings`
4. Se trovata, aggiungere il ticker alla lista dei disponibili (con deduplicazione)

```text
// Logica di risoluzione per azioni senza ticker:

positions
  .filter(p => p.asset_type === 'stock')
  .forEach(p => {
    // Se ha ticker diretto, usalo
    if (p.ticker) {
      const t = p.ticker.toUpperCase();
      if (!resolvedTickersSet.has(t)) { resolvedTickersSet.add(t); resolved.push(...); }
      return;
    }

    // Altrimenti, cerca in underlying_mappings via normalizzazione
    const descNormalized = normalizeName(p.description.replace(/^AZ\./i, ''));
    const mapping = allMappings.find(m => normalizeName(m.underlying) === descNormalized);
    if (mapping && !resolvedTickersSet.has(mapping.ticker)) {
      resolvedTickersSet.add(mapping.ticker);
      resolved.push({ underlying: p.description, ticker: mapping.ticker });
    }
  });
```

5. Importare la funzione `normalizeName` da `useUnderlyingPrices` (o duplicarla localmente, dato che e' gia' definita nello stesso modulo)

**File: `src/pages/Derivatives.tsx`**

6. Aggiungere le descrizioni delle azioni (pulite dal prefisso "AZ.") alla lista `allUnderlyingNames` passata a `useUnderlyingPrices`, in modo che il sistema risolva automaticamente i ticker anche per le azioni e li salvi in `underlying_mappings` per uso futuro

```text
// In allUnderlyingNames useMemo, aggiungere:
stockPositions.forEach(sp => {
  const cleaned = sp.description.replace(/^AZ\./i, '').trim();
  if (cleaned) names.add(cleaned);
});
```

Questo garantisce che alla prima visita della pagina Derivati, i ticker delle azioni vengano risolti e salvati in `underlying_mappings`, rendendoli disponibili per il dialog degli avvisi.

#### Parte 2: Aggiornamento cron per ticker con avvisi di prezzo

Questa funzionalita' e' **gia' implementata**. Il cron job `update-underlying-prices-cron` (linee 191-202) include gia' i ticker dalla tabella `price_alerts` con `enabled = true`. Quando un utente crea un avviso di prezzo su un ticker, quel ticker viene automaticamente incluso nel ciclo di aggiornamento prezzi ogni 5 minuti.

Nessuna modifica necessaria per questa parte.

### File da modificare

| File | Modifica |
|---|---|
| `src/pages/Derivatives.tsx` | Aggiungere descrizioni stock a `allUnderlyingNames` per risoluzione ticker |
| `src/components/derivatives/AlertSettingsDialog.tsx` | Usare `useUnderlyingMappings` + `normalizeName` per risolvere ticker da descrizioni stock |

### Risultato atteso

- I ticker delle azioni appaiono come badge cliccabili nel tab Prezzo, accanto a quelli dei derivati
- Nessun duplicato se un ticker appare sia come azione che come sottostante di un'opzione
- I ticker con avvisi attivi continuano ad essere aggiornati dal cron ogni 5 minuti (gia' funzionante)

