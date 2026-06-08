## Modifiche all'header

### 1. `src/components/layout/AppHeaderMenu.tsx`

**a) Nascondi il tasto "Dashboard" quando già su `/`**
- Usare `useLocation()` da react-router-dom.
- Renderizzare il `<Link to="/">Dashboard</Link>` solo se `location.pathname !== '/'`.

**b) Allarga il pulsante "Menù"**
- Dato che ora è (spesso) l'unico controllo, aumentarne la larghezza minima (es. `min-w-[200px]`) e mostrare a sinistra dell'icona Menu anche un'anteprima del portafoglio selezionato (icona Briefcase/Layers + nome troncato) — quando `includePortfolioSelector` è attivo. Questo evita di duplicare il selector "brutto" in cima al dropdown.

**c) Riorganizza l'interno del dropdown del PortfolioSelector**
Il problema dell'immagine è che dentro al `DropdownMenuItem` viene incollato un intero `Button` con icone + chevron + bottone X esterno, creando un blocco visivamente disordinato e troncato.

Soluzione: non inserire più il componente `PortfolioSelector` "as is" dentro al dropdown. Invece, nel dropdown del Menù mostriamo direttamente una sezione "Portafoglio" con:
- header `DropdownMenuLabel` "Portafoglio"
- riga corrente con icona + nome completo (no troncamento, larghezza ampia del dropdown) + eventuale bottone "esci da aggregato/admin" (icona X piccola a destra)
- una voce "Cambia portafoglio…" che apre il dropdown nativo del PortfolioSelector (in alternativa: mostrare direttamente l'elenco dei portafogli inline)

Soluzione più semplice e meno invasiva (consigliata):
- Allargare `DropdownMenuContent` del Menù a `w-72`.
- Wrappare il `PortfolioSelector` dentro al `DropdownMenuItem` in un contenitore `w-full px-1 py-1` e rimuovere il `min-w-[180px]` forzato del PortfolioSelector solo quando renderizzato nel menu. Per farlo, aggiungere una prop opzionale `compact?: boolean` (o `fullWidth?: boolean`) a `PortfolioSelector` che:
  - rimuove `min-w-[180px]` dal trigger e usa `w-full justify-between`
  - aumenta `max-w-` del nome troncato (es. `max-w-[200px]` o nessun limite)
  - mantiene il bottone X (exit admin/aggregated) ma in modo compatto

### 2. `src/components/portfolio/PortfolioSelector.tsx`
- Aggiungere prop `fullWidth?: boolean`. Quando true:
  - Il wrapper `div.flex` diventa `w-full`
  - Il trigger Button: `w-full justify-between` (no `min-w-[180px]`)
  - Lo span del nome: `truncate` senza `max-w-[120px]` fisso
- Default invariato per non rompere altri usi.

### 3. `AppHeaderMenu.tsx` aggiornamento
- Passare `<PortfolioSelector fullWidth />` dentro al `DropdownMenuItem`, e allargare `DropdownMenuContent` a `w-72`.

## Risultato atteso
- Nella Dashboard (`/`): visibile solo il tasto "Menù" (più largo).
- Nelle altre pagine: tasti "Dashboard" + "Menù".
- Dentro il Menù, il blocco Portfolio occupa tutta la larghezza del dropdown, nome non più troncato a 120px, layout pulito.

Nessuna modifica a logica business, routing o permessi.