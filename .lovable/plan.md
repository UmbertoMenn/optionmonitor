

# Piano: Correzione Loop Infinito in AlertSettingsDialog

## Problema Identificato

Il `useEffect` alla riga 135-189 causa un loop infinito quando le configurazioni sono vuote:

```typescript
useEffect(() => {
  if (configs.length === 0 && !isLoading) {
    // Questo chiama mutate() che invalida la query
    initializeDefaultsMutation.mutate();  // ← PROBLEMA
    return;
  }
  // ... resto del codice
}, [configs, isLoading]);
```

**Sequenza del loop:**
1. `configs` è vuoto e `isLoading` è false
2. Viene chiamato `initializeDefaultsMutation.mutate()`
3. La mutation completa e invalida la query `['alert-configs']`
4. React Query fa refetch, cambiando `configs` (anche se ancora vuoto durante il caricamento)
5. Il `useEffect` viene ri-eseguito
6. Se `configs` è ancora vuoto → torna al punto 2

---

## Soluzione

Aggiungere una `useRef` per tracciare se l'inizializzazione è già stata tentata, impedendo chiamate multiple.

### Codice Modificato

```typescript
import { useState, useEffect, useMemo, useRef } from 'react';

// ...dentro il componente:

// Ref per tracciare se l'inizializzazione è già stata tentata
const initAttemptedRef = useRef(false);

useEffect(() => {
  if (configs.length === 0 && !isLoading) {
    // Inizializza solo se non è mai stato tentato
    if (!initAttemptedRef.current) {
      initAttemptedRef.current = true;
      initializeDefaultsMutation.mutate();
    }
    return;
  }
  
  // Reset ref se abbiamo configs (per gestire logout/login)
  if (configs.length > 0) {
    initAttemptedRef.current = false;
  }
  
  // ... resto del codice esistente per popolare lo state locale
}, [configs, isLoading]);
```

---

## File da Modificare

| File | Modifica |
|------|----------|
| `src/components/derivatives/AlertSettingsDialog.tsx` | Aggiungere `useRef` e modificare la logica del `useEffect` |

---

## Dettaglio Modifiche

### Riga 1: Aggiungere `useRef` all'import

```typescript
import { useState, useEffect, useMemo, useRef } from 'react';
```

### Dopo riga 126: Aggiungere la ref

```typescript
// Ref to prevent multiple initialization attempts
const initAttemptedRef = useRef(false);
```

### Righe 135-140: Modificare la logica di inizializzazione

```typescript
useEffect(() => {
  if (configs.length === 0 && !isLoading) {
    // Only initialize once to prevent infinite loop
    if (!initAttemptedRef.current) {
      initAttemptedRef.current = true;
      initializeDefaultsMutation.mutate();
    }
    return;
  }
  
  // Reset when we have configs (handles logout/login scenarios)
  if (configs.length > 0) {
    initAttemptedRef.current = false;
  }
  
  // ... resto del codice invariato
}, [configs, isLoading]);
```

---

## Perché Questa Soluzione Funziona

1. **Prima esecuzione**: `initAttemptedRef.current` è `false`, quindi la mutation viene eseguita e la ref viene impostata a `true`
2. **Esecuzioni successive**: La ref è `true`, quindi la mutation non viene più chiamata
3. **Reset intelligente**: Se l'utente fa logout e login, quando arrivano configs validi la ref viene resettata, permettendo una nuova inizializzazione se necessario

