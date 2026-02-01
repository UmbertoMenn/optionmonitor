

# Piano: Feedback Visivo per Risoluzione Settori AI

## Problema

Quando l'utente apre la vista "Sector Allocation", la risoluzione AI dei settori impiega circa 10 secondi. Attualmente:
- Lo stato `sectorMappingsLoading` esiste nel hook ma **non viene mostrato all'utente**
- L'unico feedback è per il caricamento ETF, non per la risoluzione settori
- L'utente vede dati incompleti senza sapere che sta ancora elaborando

## Soluzione Proposta

Implementare un feedback a due livelli:

### 1. Toast Informativo con Progress (Sonner)

Mostrare un toast persistente durante la risoluzione che indica:
- Quanti ISIN/nomi devono essere risolti
- Messaggio chiaro che l'AI sta lavorando

```
┌─────────────────────────────────────────────┐
│  🔄 Aggiornamento settori in corso...       │
│  Risoluzione AI per 15 strumenti            │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━          │
└─────────────────────────────────────────────┘
```

### 2. Badge Inline nella Card Settoriale

Accanto al conteggio ETF, aggiungere un indicatore per la risoluzione settori:

```
19 settori identificati
✓ 6 ETF analizzati
🔄 Risoluzione AI in corso...  ← NUOVO
```

## Modifiche Tecniche

### File 1: `src/hooks/useSectorMappings.ts`

Aggiungere:
- Contatore `resolving` con numero di elementi da risolvere
- Callback opzionale `onResolutionStart` / `onResolutionEnd` per toast

```typescript
const [resolvingCount, setResolvingCount] = useState(0);

// Prima della chiamata edge function
setResolvingCount(isinsToResolve.length + derivativeNamesToResolve.length);

// Dopo completamento
setResolvingCount(0);

return { 
  mappings, 
  fetchMappings, 
  isLoading, 
  resolvingCount,  // NUOVO
  reset 
};
```

### File 2: `src/pages/RiskAnalyzer.tsx`

Importare `toast` da sonner e mostrare feedback:

```typescript
import { toast } from 'sonner';

const { 
  mappings: sectorMappings, 
  fetchMappings: fetchSectorMappings, 
  isLoading: sectorMappingsLoading,
  resolvingCount  // NUOVO
} = useSectorMappings();

// Mostrare toast quando inizia risoluzione
useEffect(() => {
  if (resolvingCount > 0) {
    toast.loading(`Risoluzione AI settori per ${resolvingCount} strumenti...`, {
      id: 'sector-resolution',
      duration: Infinity
    });
  } else if (sectorMappingsLoading === false) {
    toast.dismiss('sector-resolution');
  }
}, [resolvingCount, sectorMappingsLoading]);

// Passare lo stato a SectorAllocationView
<SectorAllocationView 
  // ... props esistenti
  isResolvingSectors={sectorMappingsLoading}
  resolvingCount={resolvingCount}
/>
```

### File 3: `src/components/risk/SectorAllocationView.tsx`

Aggiungere props e indicatore inline:

```typescript
interface SectorAllocationViewProps {
  // ... props esistenti
  isResolvingSectors?: boolean;
  resolvingCount?: number;
}

// Nel template, dopo l'indicatore ETF:
{isResolvingSectors && resolvingCount > 0 && (
  <span className="ml-2 text-blue-500 animate-pulse">
    🔄 Risoluzione AI ({resolvingCount} strumenti)...
  </span>
)}

{!isResolvingSectors && !isLoadingETFData && (
  <span className="ml-2 text-green-500">
    ✓ Settori aggiornati
  </span>
)}
```

## Flusso Utente Risultante

1. Utente clicca su "Sector Allocation"
2. **Toast appare**: "Risoluzione AI settori per 15 strumenti..."
3. I dati mostrano progressivamente i settori risolti
4. **Badge inline**: "🔄 Risoluzione AI (15 strumenti)..."
5. Dopo ~10s: Toast scompare, badge diventa "✓ Settori aggiornati"
6. Grafico si aggiorna con settori corretti

## File da Modificare

| File | Modifiche |
|------|-----------|
| `src/hooks/useSectorMappings.ts` | Aggiungere `resolvingCount` allo stato |
| `src/pages/RiskAnalyzer.tsx` | Mostrare toast + passare stato a view |
| `src/components/risk/SectorAllocationView.tsx` | Mostrare badge inline per risoluzione |

## Risultato Atteso

- L'utente **sa sempre** che sta avvenendo un'elaborazione
- Feedback visivo chiaro e non invasivo
- Al completamento, conferma visiva che i dati sono aggiornati

