

## Fix: Admin non presente nel dropdown "Utente Destinatario" della copia

### Problema
La lista degli utenti destinatari (`allUsersForCopy`) viene costruita a partire da `portfoliosByUser`, che contiene solo utenti che possiedono almeno un portafoglio. L'admin (UmbertoEmme) non ha portafogli propri, quindi non appare nel dropdown e non puo essere selezionato come destinatario.

### Causa
In `PortfolioManager.tsx` riga 67-73:
```tsx
const allUsersForCopy = useMemo(() => {
  return Object.values(portfoliosByUser).map(u => ({ ... }));
}, [portfoliosByUser]);
```
`portfoliosByUser` contiene solo utenti con portafogli. L'admin ha 0 portafogli, quindi non appare.

### Soluzione

Il hook `useAdminPortfolios` gia fetcha tutti i profili (query `profiles`), ma non li espone. Basta:

1. **`useAdminPortfolios.ts`**: esporre la lista completa dei profili registrati come `allRegisteredUsers`
2. **`PortfolioManager.tsx`**: usare `allRegisteredUsers` al posto di `portfoliosByUser` per costruire la lista destinatari

---

**File 1: `src/hooks/useAdminPortfolios.ts`**

Aggiungere al return del hook una nuova proprieta `allRegisteredUsers` costruita dai profili gia fetchati:

```tsx
// Dentro queryFn, restituire anche i profili
return { portfolios: portfoliosWithOwner, profiles: profiles || [] };
```

Poi derivare:
```tsx
const allRegisteredUsers = (allPortfoliosQuery.data?.profiles || []).map(p => ({
  userId: p.user_id,
  email: p.email,
  name: p.full_name,
}));
```

E aggiungerlo al return: `allRegisteredUsers`.

**File 2: `src/components/admin/PortfolioManager.tsx`**

Sostituire il `useMemo` di `allUsersForCopy` (righe 67-73) con il dato gia pronto dal hook:

```tsx
const { allPortfolios, adminPortfolios, otherUsers, portfoliosByUser, 
        allRegisteredUsers, isLoading, refetch } = useAdminPortfolios();

// Rimuovere il vecchio useMemo allUsersForCopy
// Passare direttamente allRegisteredUsers al dialog:
<CopyPortfolioDialog users={allRegisteredUsers} ... />
```

### Risultato
Tutti gli utenti registrati (incluso l'admin) appariranno sempre nel dropdown, anche se non hanno portafogli.

