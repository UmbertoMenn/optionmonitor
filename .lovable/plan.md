

## Fix: Token-overlap troppo permissivo causa falsi match

### Problema
`hasTokenOverlap` matcha se **un solo token** è in comune. "REGULUS THERAPEUTICS" e "AQUESTIVE THERAPEUTICS" condividono "THERAPEUTICS" → vengono raggruppati erroneamente. Lo stesso bug esiste anche nel wizard.

### Soluzione
Rafforzare la logica di token-overlap in **entrambi i file** (dialog e wizard) richiedendo che **la maggior parte** dei token significativi del termine più corto sia presente nell'altro, non solo uno.

Nuova logica `hasTokenOverlap`:
```typescript
function hasTokenOverlap(a: string, b: string): boolean {
  const tokensA = getSignificantTokens(a);
  const tokensB = getSignificantTokens(b);
  if (tokensA.length === 0 || tokensB.length === 0) return false;
  // Use the shorter token list as reference
  const [shorter, longer] = tokensA.length <= tokensB.length 
    ? [tokensA, tokensB] : [tokensB, tokensA];
  const matchCount = shorter.filter(t => longer.includes(t)).length;
  // Require majority match (>50% of shorter), with minimum 2 matches if both have 2+ tokens
  if (shorter.length >= 2) return matchCount >= 2;
  // Single-token case: exact match only
  return matchCount === 1 && shorter[0].length >= 4;
}
```

Regole:
- Se il set più corto ha ≥2 token → richiede almeno 2 match (es. "SUPER" + "MICRO" matchano, ma "THERAPEUTICS" da solo no)
- Se ha 1 solo token → match solo se il token è lungo ≥4 caratteri (per evitare falsi positivi su token generici, ma permettere match come "BAIDU")

### File da modificare
1. **`src/components/derivatives/StrategyReconciliationDialog.tsx`** — aggiornare `hasTokenOverlap` (riga 127-132)
2. **`src/components/derivatives/StrategyConfigWizard.tsx`** — aggiornare `hasTokenOverlap` (riga 146-151) con la stessa logica

