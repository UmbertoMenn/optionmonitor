

## Fix: "Call da rivendere" deve considerare anche le De-Risking Covered Call

### Problema
Nel componente `DerivativesSummaryCard.tsx`, la sezione "Call da rivendere" (riga ~350-377) conta solo i contratti venduti tramite `categories.coveredCalls` per calcolare quante azioni sono "scoperte" e disponibili per vendere nuove call. Le `deRiskingCoveredCalls` vengono completamente ignorate, quindi le azioni già coperte da una de-risking CC appaiono erroneamente come disponibili.

Lo stesso problema esiste nella edge function `daily-briefing/index.ts`.

### Modifica

**`src/components/derivatives/DerivativesSummaryCard.tsx`** (righe ~358-366):
- Dopo il ciclo su `categories.coveredCalls`, aggiungere un secondo ciclo su `categories.deRiskingCoveredCalls` che somma i `contractsCovered` della loro `coveredCall` interna
- Aggiungere `categories.deRiskingCoveredCalls` alle dipendenze del `useMemo`

**`supabase/functions/daily-briefing/index.ts`** (sezione "Call da rivendere"):
- Applicare la stessa logica: contare anche i contratti delle de-risking CC

### Dettaglio tecnico
```typescript
// Aggiungere dopo il ciclo coveredCalls:
categories.deRiskingCoveredCalls.forEach(dr => {
  const drKey = getMatchingKey(dr.coveredCall.underlying.description || dr.coveredCall.option.underlying || '');
  if (drKey === normalizedKey) {
    soldCallContracts += dr.coveredCall.contractsCovered;
  }
});
```

### File toccati
| File | Modifica |
|---|---|
| `src/components/derivatives/DerivativesSummaryCard.tsx` | Aggiungere conteggio deRiskingCoveredCalls nel calcolo "Call da rivendere" |
| `supabase/functions/daily-briefing/index.ts` | Stessa correzione per il briefing giornaliero |

