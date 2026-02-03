
# Piano: Correzione Aggregazione Apple nelle Holdings Consolidate

## Problema Identificato

Le azioni Apple e le relative PUT non vengono aggregate perché i nomi differiscono:
- **Stock**: `AZ.APPLE INC`
- **PUT underlying**: `APPLE COMPUTER, INC.`

Dopo la normalizzazione:
- Stock diventa: `APPLE` (rimuove "AZ." e "INC")
- PUT diventa: `APPLE COMPUTER` (rimuove "INC")

La parola "COMPUTER" non e tra gli stopword aziendali, quindi i due nomi generano chiavi diverse e non vengono aggregati.

## Soluzione

Aggiungere `APPLE` alla lista degli alias speciali (`SPECIAL_ALIASES`) in modo che tutte le variazioni del nome vengano mappate allo stesso identificatore canonico.

### Modifica File

**File: `src/lib/derivativeStrategies.ts`**

Aggiungere un nuovo entry in `SPECIAL_ALIASES`:

```typescript
export const SPECIAL_ALIASES: Record<string, string[]> = {
  ALPHABET: ['GOOGL', 'GOOG', 'GOOGLE', 'ALPHABET', 'ALPHABET INC', 'ALPHABET CLASS'],
  PDD: ['PDD', 'PINDUODUO', 'PDD HOLDINGS', 'PINDUODUO INC', 'PDD HOLDINGS INC'],
  NETEASE: ['NETEASE', 'NTES', 'NETEASE INC', 'NETEASE INC ADR'],
  ENI: ['ENI', 'ENI SPA', 'ENI STOCK', 'ENI - STOCK'],
  // NUOVO:
  APPLE: ['APPLE', 'AAPL', 'APPLE INC', 'APPLE COMPUTER', 'APPLE COMPUTER INC'],
};
```

## Impatto

Con questa modifica:
- `getCanonicalKey("AZ.APPLE INC")` restituisce `"APPLE"`
- `getCanonicalKey("APPLE COMPUTER, INC.")` restituisce `"APPLE"`
- `getHoldingKey()` produrra `"CANONICAL:APPLE"` per entrambi
- Le Holdings Consolidate aggregheranno correttamente stock e derivati Apple

## File Modificati

| File | Modifica |
|------|----------|
| `src/lib/derivativeStrategies.ts` | Aggiunta entry `APPLE` in `SPECIAL_ALIASES` |
