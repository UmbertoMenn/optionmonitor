

## Problema: toggle Telegram admin non propaga agli utenti

### Causa
Le due policy UPDATE sulla tabella `profiles` sono entrambe **RESTRICTIVE** (non permissive):
1. "Admins can update all profiles" — RESTRICTIVE
2. "Users can update own profile" — RESTRICTIVE

Con policy restrictive, **tutte** devono passare. Quando l'admin aggiorna il profilo di un altro utente:
- Policy 1 (admin) → PASS
- Policy 2 (own profile, `auth.uid() = user_id`) → FAIL

Risultato: il batch update propaga a 0 righe senza errore (PostgREST restituisce successo con 0 righe). Il toggle admin si aggiorna visivamente, ma i profili utenti restano invariati.

### Fix — Migrazione DB
Ricreare entrambe le policy UPDATE come **PERMISSIVE** (basta che una passi):

```sql
DROP POLICY "Admins can update all profiles" ON public.profiles;
DROP POLICY "Users can update own profile" ON public.profiles;

CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO public
USING (auth.uid() = user_id);
```

Nessuna modifica al codice TypeScript — il componente `AdminNotificationSettings.tsx` è già corretto.

