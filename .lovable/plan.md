

## Aggiungere frecce su/giù alla scrollbar della pagina

Il browser non supporta nativamente le frecce sulla scrollbar tramite CSS (`::-webkit-scrollbar-button` esiste ma è molto limitato e non cross-browser). L'approccio migliore è aggiungere due pulsanti fissi (freccia su e freccia giù) ai bordi dello schermo che scrollano la pagina.

### Implementazione

**File: `src/components/ui/ScrollArrows.tsx`** (nuovo)
- Creare un componente con due pulsanti fissi posizionati in basso a destra dello schermo (sopra e sotto la scrollbar visuale)
- Pulsante su: `position: fixed`, bottom-right, scroll up di ~300px con `smooth`
- Pulsante giù: sotto il pulsante su, scroll down di ~300px con `smooth`
- Nascondere il pulsante su quando si è in cima, e il pulsante giù quando si è in fondo
- Usare icone `ChevronUp` e `ChevronDown` da lucide-react
- Stile coerente col tema: sfondo `card`, bordo `border`, hover `primary`

**File: `src/App.tsx`**
- Importare e renderizzare `<ScrollArrows />` dentro il layout principale, visibile su tutte le pagine quando l'utente è autenticato

