
# Piano: Miglioramento Avvisi di Distanza

## Modifiche Richieste

1. **Slider da 0%**: Permettere di impostare la soglia di distanza a partire da 0% (attualmente parte da 1%)
2. **Disattivazione completa**: Aggiungere un toggle on/off per disattivare completamente ogni tipo di avviso di distanza
3. **Riordinamento**: Posizionare Covered Call e Naked Put per primi nella lista

---

## Modifiche Tecniche

### File 1: `src/types/alerts.ts`

Riordinare l'array `GROUPED_DISTANCE_ALERTS`:

```typescript
export const GROUPED_DISTANCE_ALERTS = [
  {
    label: 'Covered Call',
    callType: ALERT_TYPES.DISTANCE_COVERED_CALL,
    putType: null,
  },
  {
    label: 'Naked Put',
    callType: null,
    putType: ALERT_TYPES.DISTANCE_NAKED_PUT,
  },
  {
    label: 'Iron Condor',
    callType: ALERT_TYPES.DISTANCE_IRON_CONDOR_CALL,
    putType: ALERT_TYPES.DISTANCE_IRON_CONDOR_PUT,
  },
  {
    label: 'Double Diagonal',
    callType: ALERT_TYPES.DISTANCE_DOUBLE_DIAGONAL_CALL,
    putType: ALERT_TYPES.DISTANCE_DOUBLE_DIAGONAL_PUT,
  },
  {
    label: 'Alternative DD',
    callType: ALERT_TYPES.DISTANCE_ALTERNATIVE_DD_CALL,
    putType: ALERT_TYPES.DISTANCE_ALTERNATIVE_DD_PUT,
  },
];
```

### File 2: `src/components/derivatives/AlertSettingsDialog.tsx`

**Cambio 1**: Slider da 0% invece di 1%
```typescript
<Slider
  min={0}  // Era min={1}
  max={20}
  step={0.5}
/>
```

**Cambio 2**: Aggiungere stato per abilitazione/disabilitazione
```typescript
const [distanceEnabled, setDistanceEnabled] = useState<Record<AlertType, boolean>>({} as Record<AlertType, boolean>);
```

**Cambio 3**: Aggiungere Switch per ogni gruppo di avvisi
```typescript
<div className="flex items-center justify-between">
  <h4 className="font-medium">{group.label}</h4>
  <Switch
    checked={/* stato enabled per questo gruppo */}
    onCheckedChange={/* toggle */}
  />
</div>
```

**Cambio 4**: Disabilitare visivamente gli slider quando l'avviso è disattivato

---

## UI Risultante

Per ogni strategia (es. Covered Call):

```text
┌─────────────────────────────────────────┐
│ Covered Call                        [●] │  ← Toggle on/off
├─────────────────────────────────────────┤
│ Lato Call (prezzo sale)            5%   │
│ ○──────────●──────────────────────────  │  ← Slider 0-20%
└─────────────────────────────────────────┘
```

- Se disabilitato → slider in grigio, non interattivo
- Se soglia = 0% → l'avviso scatta immediatamente quando il prezzo tocca lo strike

---

## File da Modificare

| File | Modifica |
|------|----------|
| `src/types/alerts.ts` | Riordinare `GROUPED_DISTANCE_ALERTS` con Covered Call e Naked Put per primi |
| `src/components/derivatives/AlertSettingsDialog.tsx` | Slider da 0%, aggiungere toggle enabled/disabled per ogni gruppo |
