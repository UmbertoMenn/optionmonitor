
Problema individuato: il blank della sezione admin non sembra dipendere più dalla migrazione email→username. Il crash vero è in `src/components/admin/AdminPanel.tsx`.

Root cause:
- I due dialog finali vengono renderizzati sempre.
- Nel render vengono chiamati `displayName(userToDelete!)` e `displayName(resetPasswordUser!)` anche quando gli state sono `null`.
- Il `!` è solo TypeScript: a runtime non protegge nulla. Quindi React prova a leggere `full_name` da `null` e la route `/admin` va in crash subito.
- In `src/App.tsx` la route admin non è avvolta da `ErrorBoundary`, quindi il crash appare come schermata totalmente nera o bianca.

Piano di fix:
1. Correggere `src/components/admin/AdminPanel.tsx`
- Rendere i dialog di eliminazione e reset password condizionali, ad esempio mostrandoli solo se `userToDelete` / `resetPasswordUser` esistono davvero.
- Rimuovere ogni accesso diretto a oggetti nulli nel render.
- Usare fallback sicuri nei testi dei dialog invece di `displayName(...)` su valori non garantiti.

2. Mettere in sicurezza la route admin in `src/App.tsx`
- Wrappare `<AdminPanel />` con `ErrorBoundary`, come già fatto per la dashboard.
- In questo modo, se in futuro un componente admin rompe il render, vedremo un fallback leggibile invece di una pagina vuota.

3. Hardening rapido correlato
- Ricontrollare `AdminPanel`, `PortfolioManager` e `AdminNotificationSettings` per eventuali altri accessi immediati a valori potenzialmente null/undefined.
- Lasciare invariata la parte username, che nei file letti è già stata aggiornata.

Verifica prevista dopo il fix:
- Aprire `/admin` con dialog chiusi: devono comparire header, tabs e tab “Utenti”.
- Aprire dialog “Elimina utente” e “Reset password” per verificare che i testi si popolino correttamente.
- Controllare sia tema dark sia light per confermare che non ci sia più la schermata blank.

Dettaglio tecnico:
- Le righe critiche sono quelle che usano `userToDelete!` e `resetPasswordUser!` dentro il JSX dei dialog.
- Non servono modifiche database o backend per questo fix: è un problema di render React lato client.
