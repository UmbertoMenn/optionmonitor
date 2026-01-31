

# Piano: Fix Classificazione NETEASE in Covered Call e Protezioni

## Problema Identificato

NETEASE non viene classificato correttamente nonostante abbia:
- 200 azioni (2 record da 100)
- 1 CALL venduta (dovrebbe essere Covered Call)
- 1 PUT comprata (dovrebbe essere Protezione)

### Analisi Root Cause

Ho tracciato il flusso e identificato che il problema è nella funzione `findUnderlyingStock` che non sta trovando corrispondenza tra:

| Tipo | Campo | Valore |
|------|-------|--------|
| Opzione | `underlying` | `"NETEASE INC"` |
| Stock | `description` | `"AZ.NETEASE INC-ADR"` |

La normalizzazione **dovrebbe** funzionare:
- Stock normalizzato: `"NETEASE"` (dopo rimozione di AZ., -, INC, ADR)
- Opzione normalizzata: `"NETEASE"` (dopo rimozione di INC)

Tuttavia, ci sono due possibili cause del fallimento:

1. **Ordine delle operazioni regex**: La rimozione dei suffissi (INC, ADR) crea spazi multipli che non vengono normalizzati
2. **Bug nel confronto token**: Il filtro `w.length > 2` potrebbe escludere token validi in casi edge

## Soluzione Proposta

### Step 1: Fix nella funzione `normalizeForMatching`

Aggiungere una normalizzazione spazi **dopo** la rimozione dei suffissi per evitare spazi multipli residui:

```typescript
function normalizeForMatching(text: string): string {
  return text
    .toUpperCase()
    .replace(/^AZ\./i, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\b(INC|CORP|CORPORATION|LTD|LIMITED|CLASS\s*[A-Z]?|COMMON|STOCK|DEL|OHIO|CA|THE|ADR)\b/gi, '')
    .replace(/\s+/g, ' ')  // <-- SPOSTATO QUI: normalizza spazi DOPO rimozione suffissi
    .trim();
}
```

### Step 2: Aggiungere NETEASE agli alias speciali (backup)

Per garantire il matching anche in casi edge, aggiungere NETEASE alla lista degli alias:

```typescript
const SPECIAL_ALIASES: Record<string, string[]> = {
  ALPHABET: ['GOOGL', 'GOOG', 'GOOGLE', 'ALPHABET', 'ALPHABET INC', 'ALPHABET CLASS'],
  PDD: ['PDD', 'PINDUODUO', 'PDD HOLDINGS', 'PINDUODUO INC', 'PDD HOLDINGS INC'],
  NETEASE: ['NETEASE', 'NTES', 'NETEASE INC', 'NETEASE INC ADR'],  // <-- NUOVO
};
```

### Step 3: Migliorare il matching per token

Ridurre la soglia `required` da `Math.min(2, stockTokens.length)` a sempre `1` quando il nome stock è composto da una sola parola significativa:

```typescript
if (stockTokens.length > 0) {
  const shared = stockTokens.filter(t => optionTokens.includes(t)).length;
  // Se lo stock ha un nome mono-parola (es. NETEASE), basta 1 match
  const required = stockTokens.length === 1 ? 1 : Math.min(2, stockTokens.length);
  if (shared >= required) return stock;
}
```

## File da Modificare

| File | Modifica |
|------|----------|
| `src/lib/derivativeStrategies.ts` | Fix `normalizeForMatching`, aggiunta alias NETEASE, miglioramento token matching |

## Risultato Atteso

Dopo le modifiche:
- La CALL venduta NETEASE 145 FEB/26 apparirà in "Covered Call"
- La PUT comprata NETEASE 80 JAN/27 apparirà in "Protezioni - Long Put"
- Le altre opzioni NETEASE rimarranno raggruppate in "Altre Strategie"

## Testing

1. Verificare nella pagina Derivati che NETEASE appaia in Covered Call
2. Verificare nella pagina Derivati che NETEASE appaia in Protezioni
3. Verificare nel Risk Analyzer che il rischio stocks per NETEASE consideri la protezione

