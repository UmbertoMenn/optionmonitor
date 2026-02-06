

# Piano: Fix Ticker Resolution + Integrazione UI Notifiche

## Problema 1: Ticker non trovati

### Causa Root
Il frontend in `useUnderlyingPrices.ts` normalizza i nomi (rimuovendo CORP, INC, LTD) prima di fare la query:

```typescript
const normalizedUnderlyings = uniqueUnderlyings.map(u => normalizeName(u));
const { data: mappings } = await supabase
  .from('underlying_mappings')
  .select('underlying, ticker')
  .in('underlying', uniqueNormalized);
```

Ma la cache `underlying_mappings` contiene nomi NON normalizzati come "NVIDIA CORP", "ALPHABET INC".

### Soluzione
Modificare la logica di lookup per fare una ricerca case-insensitive con ILIKE o usare la stessa logica di matching del backend:

1. **Opzione A (consigliata)**: Salvare SEMPRE i nomi normalizzati nel database durante il salvataggio nella edge function

2. **Opzione B**: Modificare il frontend per fare una ricerca piu flessibile usando ILIKE su ogni underlying

---

## Problema 2: UI Notifiche Email/Telegram mancante

Il componente `NotificationSettings` esiste in `src/components/settings/NotificationSettings.tsx` ma non e integrato da nessuna parte.

### Soluzione
Aggiungere un nuovo Tab "Notifiche" nel dialog `AlertSettingsDialog.tsx` che mostri il componente `NotificationSettings`.

---

## Modifiche Previste

### File: `src/hooks/useUnderlyingPrices.ts`
Correggere la logica di lookup per essere consistente con come i dati vengono salvati:
- Rimuovere la normalizzazione prima della query
- Cercare i nomi originali cosi come arrivano
- Oppure usare una ricerca fuzzy con ILIKE

### File: `supabase/functions/fetch-underlying-prices/index.ts`
Assicurarsi che i mapping vengano salvati con chiavi normalizzate in modo consistente.

### File: `src/components/derivatives/AlertSettingsDialog.tsx`
- Aggiungere import di `NotificationSettings`
- Aggiungere un quinto Tab "Notifiche" nella TabsList
- Includere `NotificationSettings` nel TabsContent

---

## Schema Modifiche

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    FIX TICKER RESOLUTION                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  PRIMA (BUG):                                                        │
│  ┌────────────────┐     ┌────────────────┐     ┌──────────────────┐ │
│  │  "NVIDIA CORP" │────▶│  normalize()   │────▶│  Query: "NVIDIA" │ │
│  └────────────────┘     └────────────────┘     └──────────────────┘ │
│                                                          │           │
│                                    DB contiene:          ▼           │
│                               "NVIDIA CORP" ≠ "NVIDIA"  ❌           │
│                                                                      │
│  DOPO (FIX):                                                         │
│  ┌────────────────┐     ┌────────────────────────────────────────┐  │
│  │  "NVIDIA CORP" │────▶│  Query originale O ricerca fuzzy       │  │
│  └────────────────┘     └────────────────────────────────────────┘  │
│                                                          │           │
│                                    DB contiene:          ▼           │
│                               "NVIDIA CORP" = Match!    ✅           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Ordine di Implementazione

1. **Fix `useUnderlyingPrices.ts`**: Rimuovere normalizzazione pre-query o usare ricerca originale + normalizzata come fallback
2. **Aggiungere Tab Notifiche in `AlertSettingsDialog.tsx`**: Importare e integrare `NotificationSettings`
3. **Test End-to-End**: Verificare che NVIDIA e GOOGLE vengano trovati + UI notifiche visibile

---

## Dettagli Tecnici - Fix Ticker Lookup

Modifica in `useUnderlyingPrices.ts`:

```typescript
// PRIMA (bug)
const normalizedUnderlyings = uniqueUnderlyings.map(u => normalizeName(u));
const { data: mappings } = await supabase
  .from('underlying_mappings')
  .select('underlying, ticker')
  .in('underlying', uniqueNormalized);

// DOPO (fix)
// Step 1: Query con nomi originali
const { data: mappings } = await supabase
  .from('underlying_mappings')
  .select('underlying, ticker')
  .in('underlying', uniqueUnderlyings);

// Step 2: Per quelli non trovati, cerca con nome normalizzato
const foundOriginals = new Set(mappings?.map(m => m.underlying) || []);
const notFound = uniqueUnderlyings.filter(u => !foundOriginals.has(u));

if (notFound.length > 0) {
  const normalizedNotFound = notFound.map(u => normalizeName(u));
  const { data: normalizedMappings } = await supabase
    .from('underlying_mappings')
    .select('underlying, ticker')
    .in('underlying', normalizedNotFound);
  // Merge results
}
```

---

## Dettagli Tecnici - Integrazione UI Notifiche

Modifica in `AlertSettingsDialog.tsx`:

```typescript
// Aggiungere import
import { NotificationSettings } from '@/components/settings/NotificationSettings';

// Modificare TabsList da 4 a 5 colonne
<TabsList className="grid w-full grid-cols-5">
  <TabsTrigger value="distance">Distanza</TabsTrigger>
  <TabsTrigger value="ticker">Per Ticker</TabsTrigger>
  <TabsTrigger value="action">Azione</TabsTrigger>
  <TabsTrigger value="cooldown">Cooldown</TabsTrigger>
  <TabsTrigger value="notifications">Notifiche</TabsTrigger>
</TabsList>

// Aggiungere TabsContent
<TabsContent value="notifications" className="mt-4">
  <NotificationSettings />
</TabsContent>
```

