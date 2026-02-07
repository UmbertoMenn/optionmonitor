
# Piano: Fix Matching JPMorgan + Scrollbar Lista Stock

## Problema 1: CALL JPMorgan non riconosciuta come Covered Call

### Causa Radice
La normalizzazione di `"J.P. MORGAN"` produce `"J P MORGAN"` (3 token separati), mentre `"JPMORGAN"` resta un token unico. Il token matching fallisce perché non trova abbastanza overlap.

### Soluzione
Aggiungere JPMORGAN agli alias speciali in `SPECIAL_ALIASES` e migliorare la normalizzazione per gestire abbreviazioni con punti.

#### Modifiche in `src/lib/derivativeStrategies.ts`:

**1. Estendere `SPECIAL_ALIASES`:**
```typescript
export const SPECIAL_ALIASES: Record<string, string[]> = {
  // ... existing aliases ...
  JPMORGAN: ['JPMORGAN', 'JP MORGAN', 'J.P. MORGAN', 'JPMORGAN CHASE', 'JP MORGAN CHASE', 'J.P. MORGAN CHASE'],
};
```

**2. Migliorare `normalizeForMatching()` per collassare abbreviazioni con punti:**
```typescript
export function normalizeForMatching(text: string): string {
  return text
    .toUpperCase()
    .replace(/^AZ\./i, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/([A-Z])\.([A-Z])/g, '$1$2')  // ← NUOVO: "J.P." diventa "JP"
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\b(INC|CORP|CORPORATION|LTD|LIMITED|CLASS\s*[A-Z]?|COMMON|STOCK|DEL|OHIO|CA|THE|ADR|SPA|AG|SA|NV|PLC)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}
```

Con questa modifica:
- `"J.P. MORGAN CHASE & CO"` → `"JP MORGAN CHASE CO"`

Questo non basta ancora perché `"JPMORGAN"` ≠ `"JP MORGAN"`.

**3. Aggiungere preprocessing in `findUnderlyingStock()` per unire token di 1-2 lettere:**
```typescript
// Prima del token matching, prova a unire lettere isolate
// "JP MORGAN" → "JPMORGAN"
const collapseShortTokens = (text: string): string => {
  return text.replace(/\b([A-Z]{1,2})\s+(?=[A-Z])/g, '$1');
};

const optionCollapsed = collapseShortTokens(optionNormalized);
const stockCollapsed = collapseShortTokens(stockNormalized);
// Usa anche questi per il matching
```

---

## Problema 2: Scrollbar invisibile nella lista stock

### Causa Radice
Il `<div className="overflow-y-auto">` usa la scrollbar nativa del browser, che su molti sistemi (macOS, Windows con overlay scrollbars) è invisibile finché non si inizia a scrollare. L'utente non sa che può scorrere.

### Soluzione
Usare il componente `ScrollArea` di Radix che mostra una scrollbar sempre visibile.

#### Modifiche in `src/components/derivatives/MoveOptionMenu.tsx`:

**1. Import ScrollArea:**
```typescript
import { ScrollArea } from '@/components/ui/scroll-area';
```

**2. Sostituire il div con ScrollArea:**

Linee 245-270, da:
```tsx
{availableStocks.length > matchingStocks.length && (
  <div className="mt-4">
    <p className="text-xs text-muted-foreground mb-2">Altri titoli disponibili:</p>
    <div className="space-y-1 max-h-40 overflow-y-auto">
      {/* ... items ... */}
    </div>
  </div>
)}
```

A:
```tsx
{availableStocks.length > matchingStocks.length && (
  <div className="mt-4">
    <p className="text-xs text-muted-foreground mb-2">Altri titoli disponibili:</p>
    <ScrollArea className="h-40">
      <div className="space-y-1 pr-3">
        {/* ... items ... */}
      </div>
    </ScrollArea>
  </div>
)}
```

**3. Applicare lo stesso fix alla sezione "Titoli suggeriti" (se può essere lunga):**
Per consistenza, wrappare anche la lista dei titoli suggeriti in ScrollArea se supera un certo numero.

---

## File Coinvolti

| File | Tipo Modifica |
|------|---------------|
| `src/lib/derivativeStrategies.ts` | Aggiungi alias JPMORGAN, migliora normalizzazione |
| `src/components/derivatives/MoveOptionMenu.tsx` | Usa ScrollArea per liste stock |

---

## Dettagli Tecnici

### Normalizzazione migliorata (esempio)

| Input | Attuale | Con Fix |
|-------|---------|---------|
| `"J.P. MORGAN CHASE"` | `"J P MORGAN CHASE"` | `"JPMORGAN CHASE"` |
| `"AZ.JPMORGAN CHASE"` | `"JPMORGAN CHASE"` | `"JPMORGAN CHASE"` |

### Matching JPMorgan

Dopo il fix:
1. L'opzione `"J.P. MORGAN CHASE & CO"` viene normalizzata a `"JPMORGAN CHASE CO"`
2. Lo stock `"AZ.JPMORGAN CHASE & CO"` viene normalizzato a `"JPMORGAN CHASE CO"`
3. I token matchano perfettamente → Covered Call riconosciuta

### ScrollArea comportamento

ScrollArea di Radix:
- Mostra sempre la scrollbar (stile semi-trasparente)
- Diventa più opaca al hover
- Funziona uniformemente su tutti i browser/OS
- Mantiene l'accessibilità (keyboard scrolling)

---

## Test di Verifica

1. **JPMorgan Covered Call**:
   - Caricare un Excel con stock JPMorgan + CALL venduta JPMorgan
   - Verificare che appaia nella sezione "Covered Call"
   - Console log dovrebbe mostrare: `[CoveredCall] Matching "J.P. MORGAN...": FOUND -> AZ.JPMORGAN...`

2. **Scrollbar stock**:
   - Aprire dialog "Sposta opzione" su un'opzione
   - Verificare che la sezione "Altri titoli disponibili" mostri la scrollbar
   - Verificare che si possa scorrere per vedere tutti i titoli

---

## Edge Cases Gestiti

| Caso | Comportamento |
|------|---------------|
| `"J.P.MORGAN"` (senza spazio) | → `"JPMORGAN"` |
| `"J. P. MORGAN"` (con spazi) | → `"JPMORGAN"` dopo collapse |
| `"JPMORGAN"` (già unito) | → `"JPMORGAN"` (invariato) |
| Lista con 2 stock | ScrollArea comunque presente, scrollbar appare se necessaria |
| Lista con 20 stock | Scrollbar visibile, altezza fissa 160px |
