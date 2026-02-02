

# Piano: Override Manuale Settori (Solo Admin) + Fix Google

## Riepilogo

Implementazione della funzionalità di override manuale dei settori dalla vista Sector Allocation, accessibile esclusivamente agli amministratori. Le modifiche vengono salvate nella tabella `isin_mappings` e condivise globalmente tra tutti gli utenti.

---

## Parte 1: Fix Classificazione Google

### Problema
Nella `KNOWN_SECTORS` dell'edge function, GOOGL e GOOG sono mappati su "Communication Services" (classificazione GICS ufficiale). L'utente preferisce "Technology".

### Soluzione
Modificare la mappatura statica in `update-prices-cron/index.ts`:

| File | Modifica |
|------|----------|
| `supabase/functions/update-prices-cron/index.ts` | Linee 114-115: Cambiare `Communication Services` in `Technology` per GOOGL e GOOG |

---

## Parte 2: Consultare DB Prima di AI per Derivati

### Problema Attuale
Quando si risolvono i settori per i nomi dei derivati (es. "GOOGLE CORP"), il sistema:
1. Inferisce il ticker
2. Chiama direttamente `fetchSectorWithAI()` - **senza controllare prima i mapping manuali**

### Soluzione
Prima di chiamare l'AI, verificare se esiste un mapping manuale nel database per quel ticker.

| File | Modifica |
|------|----------|
| `supabase/functions/update-prices-cron/index.ts` | Linee 977-979: Aggiungere controllo DB prima di chiamare `fetchSectorWithAI()` |

```text
FLUSSO ATTUALE:
  inferredTicker → fetchSectorWithAI()

FLUSSO CORRETTO:
  inferredTicker → Query DB per ticker → se trovato, usa quello
                                       → altrimenti, fetchSectorWithAI()
```

---

## Parte 3: Override Manuale - UI (Solo Admin)

### Nuovi Componenti

| File | Descrizione |
|------|-------------|
| `src/components/risk/SectorOverrideDialog.tsx` | Dialog modale per selezionare nuovo settore GICS |
| `src/hooks/useSectorOverride.ts` | Hook per salvare override su `isin_mappings` |

### Modifiche a Componenti Esistenti

| File | Modifica |
|------|----------|
| `src/components/risk/SectorAllocationView.tsx` | Aggiungere icona "modifica" (Pencil) accanto a ogni strumento - **visibile solo se `isAdmin`** |
| `src/pages/RiskAnalyzer.tsx` | Passare `isAdmin` e callback refresh a `SectorAllocationView` |
| `src/hooks/useSectorMappings.ts` | Aggiungere metodo `invalidateAndRefetch()` per forzare refresh dopo modifica |

### Props Aggiuntive per SectorAllocationView

```typescript
interface SectorAllocationViewProps {
  // ... props esistenti
  isAdmin: boolean;
  onSectorOverride?: (instrument: InstrumentInfo, newSector: string) => Promise<void>;
  onRefreshMappings?: () => void;
}
```

---

## Parte 4: Logica di Salvataggio Override

### Strumenti con ISIN (azioni dirette, ETF)
```typescript
await supabase
  .from('isin_mappings')
  .upsert({
    isin: instrument.isin,
    ticker: instrument.ticker || 'UNKNOWN',
    sector: newSector,
    source: 'manual',
    last_verified_at: new Date().toISOString()
  }, { onConflict: 'isin' });
```

### Strumenti senza ISIN (derivati)
Creare un ISIN sintetico basato sul ticker:
```typescript
const syntheticIsin = `TICKER:${ticker.toUpperCase()}`;
await supabase
  .from('isin_mappings')
  .upsert({
    isin: syntheticIsin,
    ticker: ticker.toUpperCase(),
    sector: newSector,
    source: 'manual',
    last_verified_at: new Date().toISOString()
  }, { onConflict: 'isin' });
```

---

## Parte 5: Lookup Aggiornato per ISIN Sintetici

### Modifica a useSectorMappings.ts

Quando si cercano i mapping per derivati, cercare anche gli ISIN sintetici:

```typescript
// Per ogni nome derivativo, costruire ISIN sintetico
const tickerIsins = derivativeNames.map(name => {
  const ticker = extractTickerFromName(name);
  return ticker ? `TICKER:${ticker.toUpperCase()}` : null;
}).filter(Boolean);

// Query unica con tutti gli ISIN (reali + sintetici)
const allIsins = [...realIsins, ...tickerIsins];
```

---

## File da Modificare/Creare

| File | Azione | Descrizione |
|------|--------|-------------|
| `supabase/functions/update-prices-cron/index.ts` | Modifica | Fix GOOGL/GOOG + controllo DB prima di AI |
| `src/components/risk/SectorOverrideDialog.tsx` | **Nuovo** | Dialog per override settore |
| `src/hooks/useSectorOverride.ts` | **Nuovo** | Hook per CRUD override |
| `src/components/risk/SectorAllocationView.tsx` | Modifica | Icona edit (solo admin) + dialog |
| `src/pages/RiskAnalyzer.tsx` | Modifica | Passare `isAdmin` a SectorAllocationView |
| `src/hooks/useSectorMappings.ts` | Modifica | Supportare lookup ISIN sintetici + refresh |

---

## UX - Vista Sector Allocation (Admin)

```text
┌────────────────────────────────────────────────────────────────┐
│ ▼ Technology                                   [15] 45.2% €123K│
├────────────────────────────────────────────────────────────────┤
│   📈 NVIDIA CORP                                  €50,000   ✏️ │
│   📈 ALPHABET (PUT 180)                           €30,000   ✏️ │
│   📊 iShares Technology ETF [ETF]                 €23,000   ✏️ │
└────────────────────────────────────────────────────────────────┘
        ↑                                                     ↑
   Icona tipo asset                               Solo se isAdmin
```

### Dialog Override (Solo Admin)

```text
┌─────────────────────────────────────────────┐
│  Modifica Settore                       ✕   │
├─────────────────────────────────────────────┤
│                                             │
│  Strumento: ALPHABET (PUT 180)              │
│  Settore attuale: Communication Services    │
│                                             │
│  Nuovo settore:                             │
│  ┌─────────────────────────────────────┐    │
│  │ Technology                        ▼ │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ⓘ La modifica sarà salvata nella cache    │
│    globale e visibile a tutti gli utenti   │
│                                             │
│           [Annulla]  [Salva]                │
└─────────────────────────────────────────────┘
```

---

## Controllo Accesso Admin

Il sistema già dispone di `useAuth()` con `isAdmin` verificato lato server tramite la tabella `user_roles`:

```typescript
// In RiskAnalyzer.tsx
const { isAdmin } = useAuth();

<SectorAllocationView 
  {...otherProps}
  isAdmin={isAdmin}
/>
```

```typescript
// In SectorAllocationView.tsx
{isAdmin && (
  <Button variant="ghost" size="icon" onClick={() => openOverrideDialog(instrument)}>
    <Pencil className="w-3.5 h-3.5" />
  </Button>
)}
```

---

## Sicurezza

- **Controllo UI**: L'icona di modifica viene mostrata solo se `isAdmin === true`
- **Controllo DB**: La tabella `isin_mappings` ha RLS policy che permette scritture solo agli admin:
  ```sql
  Policy: "Admins can manage isin mappings"
  Command: ALL
  Using: has_role(auth.uid(), 'admin')
  ```
- **Nessun rischio di privilege escalation**: Lo stato `isAdmin` viene verificato lato server dalla tabella `user_roles`, non da localStorage

---

## Note Tecniche

1. **Priorità mapping**: `manual` > `yahoo_search` > `ai` > `unknown`
2. **Cache globale**: Tutti gli utenti vedono le stesse classificazioni settoriali
3. **Persistenza**: Override salvati in Supabase, non in localStorage
4. **Lista settori GICS**: Stessa utilizzata in `SectorMappingManager.tsx` (Admin Panel)
5. **Refresh automatico**: Dopo ogni override, i mapping vengono ricaricati per aggiornare la UI

