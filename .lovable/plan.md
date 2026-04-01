

## Piano: Fix pannello admin nero + completare migrazione email→username

### Problema identificato
Diversi file non sono stati aggiornati completamente nella migrazione email→username:

1. **`src/hooks/useAdminPortfolios.ts`** — la query profiles seleziona solo `user_id, email, full_name` senza `username`. Il `portfoliosByUser` espone ancora `email` come chiave di raggruppamento.

2. **`src/components/admin/PortfolioManager.tsx`** — linea 148 mostra `userGroup.email` (l'indirizzo `@internal.local`) e linea 152 mostra `userGroup.email` di nuovo. Deve mostrare `username`.

3. **`src/components/admin/AdminNotificationSettings.tsx`** — linea 65 la query non seleziona `username`, quindi `(p as any).username` è sempre undefined.

### File da modificare

**`src/hooks/useAdminPortfolios.ts`**:
- Aggiungere `username` alla select dei profiles (linea 29)
- Aggiornare il profileMap per includere `username`
- Nel `portfoliosByUser`, sostituire `email` con `username` derivato dal profilo
- Negli `allRegisteredUsers`, usare il campo `username` direttamente

**`src/components/admin/PortfolioManager.tsx`**:
- Linea 148: sostituire `userGroup.email` con `userGroup.username`
- Linea 150-153: aggiornare il sottotitolo per mostrare `@username` invece dell'email

**`src/components/admin/AdminNotificationSettings.tsx`**:
- Linea 65: aggiungere `username` alla select query

### Dettaglio tecnico

```typescript
// useAdminPortfolios.ts - select aggiornata
.select('user_id, email, full_name, username')

// profileMap aggiornato
const profileMap = new Map(
  (profiles || []).map(p => [p.user_id, { 
    email: p.email, 
    name: p.full_name,
    username: p.username || p.email?.replace('@internal.local', '') || null
  }])
);

// portfoliosByUser con username
acc[key] = {
  userId: key,
  username: profileMap.get(portfolio.user_id)?.username || portfolio.owner_email?.replace('@internal.local', ''),
  name: portfolio.owner_name,
  portfolios: [],
};
```

