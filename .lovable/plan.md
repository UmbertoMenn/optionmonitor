

# Piano: Regola di separazione per scadenze distanti (>12 mesi)

## Problema
Nello Step 5, tutte le opzioni con lo stesso sottostante vengono raggruppate in "Altre Strategie" se sono più di una, senza considerare che opzioni con scadenze molto distanti non formano una strategia vera.

## Soluzione
Aggiungere un controllo sulla differenza di scadenze: se le opzioni di un gruppo hanno scadenze che differiscono di **più di 12 mesi**, vanno trattate come **gambe singole** e non come strategia.

---

## Logica Proposta

### Modifica Step 5 (righe 278-290)

```text
Per ogni gruppo di opzioni con stesso sottostante:
  1. Se tutte le scadenze sono entro 12 mesi l'una dall'altra:
     → Raggruppa in "Altre Strategie" (comportamento attuale)
  
  2. Se almeno due scadenze differiscono di più di 12 mesi:
     → NON raggruppare, lascia passare allo Step 6 (singole gambe)
```

### Calcolo Differenza Scadenze

```text
function hasCloseExpiries(options: Position[]): boolean {
  const dates = options
    .map(o => new Date(o.expiry_date))
    .filter(d => !isNaN(d.getTime()));
  
  if (dates.length < 2) return true; // una sola scadenza = ok
  
  const maxDate = Math.max(...dates.map(d => d.getTime()));
  const minDate = Math.min(...dates.map(d => d.getTime()));
  const diffMonths = (maxDate - minDate) / (1000 * 60 * 60 * 24 * 30);
  
  return diffMonths <= 12; // true se entro 12 mesi
}
```

---

## Modifica al Codice

### File: `src/lib/derivativeStrategies.ts`

**Aggiungere funzione helper** (prima dello Step 5):

```typescript
// Verifica se tutte le scadenze sono entro 12 mesi l'una dall'altra
const hasCloseExpiries = (options: Position[]): boolean => {
  const dates = options
    .map(o => o.expiry_date ? new Date(o.expiry_date) : null)
    .filter((d): d is Date => d !== null && !isNaN(d.getTime()));
  
  if (dates.length < 2) return true;
  
  const timestamps = dates.map(d => d.getTime());
  const maxDate = Math.max(...timestamps);
  const minDate = Math.min(...timestamps);
  const diffMonths = (maxDate - minDate) / (1000 * 60 * 60 * 24 * 30);
  
  return diffMonths <= 12;
};
```

**Modificare Step 5** (righe 278-290):

```typescript
// For groups with more than 1 option AND close expiries, put in "Altre Strategie"
for (const [, group] of regrouped.entries()) {
  if (group.length > 1 && hasCloseExpiries(group)) {
    for (const option of group) {
      const underlyingStock = findUnderlyingStock(option, stockPositions);
      otherStrategies.push({
        option,
        underlying: underlyingStock || null
      });
      usedDerivatives.add(option.id);
    }
  }
  // Se scadenze distanti (>12 mesi), le opzioni passano allo Step 6
}
```

---

## Risultato Atteso

### Caso Google

| Opzione | Scadenza | Differenza | Classificazione |
|---------|----------|------------|-----------------|
| PUT 295 venduta | Feb 2026 | - | **Naked Put** |
| PUT 220 comprata | Dic 2027 | ~22 mesi | **Protezione (P!)** |

Le due PUT hanno scadenze distanti >12 mesi → non vengono raggruppate → passano allo Step 6 → classificate individualmente.

### Strategia vera (esempio)

| Opzione | Scadenza | Differenza | Classificazione |
|---------|----------|------------|-----------------|
| PUT 290 venduta | Mar 2026 | - | **Altre Strategie** |
| PUT 280 comprata | Mar 2026 | 0 mesi | **Altre Strategie** |

Stessa scadenza → raggruppate in "Altre Strategie" come spread.

---

## Riepilogo Tecnico

| Elemento | Dettaglio |
|----------|-----------|
| File da modificare | `src/lib/derivativeStrategies.ts` |
| Nuova funzione | `hasCloseExpiries(options)` |
| Punto di modifica | Step 5, riga 280 |
| Soglia temporale | 12 mesi |
| Impatto | Solo opzioni con scadenze distanti passano a Step 6 |

