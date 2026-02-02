
Obiettivo
- Correggere definitivamente “Holdings Consolidate” quando aggrega valori di Stock e Naked PUT su nomi simili (es. ALIBABA) producendo importi gonfiati (es. Stock 31.973€ e PUT 174.185€ con sole 100 azioni e 2 PUT vendute).
- Garantire che il bug non si ripresenti: test automatici + controlli di sicurezza nel matching.

Diagnosi (cosa sta succedendo davvero)
- I dati nel database per ALIBABA nel portafoglio corretto sono coerenti: 100 azioni + 2 PUT vendute (165 e 170), più altre gambe (CALL venduta e PUT comprata) che NON devono entrare in “Naked PUT”.
- L’errore mostrato nello screenshot (PUT enormemente più alto) non può derivare dai due contratti -1/-1: per arrivare a ~174k€ significa che stanno venendo “accorpati” anche Naked PUT di altri sottostanti dentro la riga “ALIBABA”.
- Il punto fragile è il matching “fuzzy” in `src/lib/sectorExposure.ts`:
  - `getOrCreateHolding()` scansiona tutte le entry esistenti e usa `isSameHolding()`.
  - `isSameHolding()` è troppo permissiva sui nomi multi-parola: può considerare uguali aziende diverse se condividono parole “generiche” (es. HOLDING / HOLDINGS / GROUP).
  - Risultato: più sottostanti finiscono nello stesso bucket, gonfiando sia Stock che PUT.

Strategia di fix “una volta per tutte”
1) Rendere il matching tra holding deterministico e più “sicuro”
   - Introdurre una funzione `getHoldingKey(name)` che produce una chiave stabile e “distintiva”:
     - Normalizza (già esiste `normalizeForMatching`).
     - Tokenizza.
     - Rimuove “stopwords” aziendali generiche che causano collisioni (esempi: GROUP, HOLDING, HOLDINGS, COMPANY, CO, etc.). Nota: molte sigle legali (INC/LTD/SPA/ADR…) sono già rimosse da `normalizeForMatching`, ma GROUP/HOLDING oggi NO.
     - Mantiene solo token significativi (lunghezza >= 3, non numeri puri).
     - Regole:
       - Se rimangono 0 token significativi: niente fuzzy match, solo match esatto su `normalizeForMatching(name)`.
       - Se rimane 1 token significativo: match solo se quel token coincide esattamente (o coincide via alias canonico).
       - Se rimangono >=2 token: match per somiglianza alta (es. intersection/union >= 0.75) oppure “tutti i token del più corto sono contenuti nel più lungo”, evitando match basati su 1 sola parola.
   - Integrare `getCanonicalKey()` (alias speciali già presenti) come scorciatoia: se canonico uguale, match vero.

2) Eliminare l’O(N²) “scan di nomi” e usare mappa per chiave
   - In `calculateConsolidatedTopHoldings()` sostituire:
     - `holdingsMap: Map<string, ConsolidatedHolding>` (chiave = display name) + loop che cerca “simili”
   - Con:
     - `holdingsByKey: Map<string, ConsolidatedHolding>` (chiave = holdingKey)
     - `displayName` tenuto come “primo nome visto” o preferenza per quello stock diretto (es. se esiste una stock diretta “AZ.ALIBABA …”, usare quello come label).
   - Questo rende il comportamento stabile e riduce accorpamenti casuali dovuti all’ordine di iterazione.

3) Debug “a prova di utente” (non solo console.log)
   - Aggiungere nel pannello “Holdings Consolidate” la possibilità di espandere ogni holding e vedere:
     - Elenco PUT incluse (strike, contratti, riskEUR)
     - Sorgenti ETF (nome ETF e %)
     - Stock (valore o rischio, e se include protezioni)
   - Questo serve sia per verificare subito ALIBABA, sia per prevenire discussioni future: il breakdown rende immediatamente visibile se stanno entrando PUT di altri sottostanti.

4) Test automatici (per prevenire regressioni)
   - Aggiungere test unitari (Vitest) per:
     - `getHoldingKey()` e `isSameHolding()` (o la nuova logica di match):
       - Deve matchare: “AZ.ALIBABA GROUP HOLDING LTD” ↔ “ALIBABA GROUP HOLDING LTD”
       - NON deve matchare: “ALIBABA GROUP HOLDING LTD” ↔ “CK HUTCHISON HOLDINGS LTD” (condivide HOLDING/HOLDINGS/LTD ma è azienda diversa)
       - NON deve matchare: qualsiasi “... GROUP HOLDING ...” con “ALIBABA ...” se manca un token distintivo comune (“ALIBABA”).
     - `calculateConsolidatedTopHoldings()` con un RiskAnalysis mock:
       - 100 azioni ALIBABA (stockValue coerente) + 2 naked put (165, 170) + altre naked put su un’altra holding “XYZ HOLDINGS”
       - Verifica che ALIBABA includa SOLO le sue PUT e non quelle di XYZ.
   - Aggiungere un test specifico che replica il caso “screenshot”: se una holding finisce con PUT > soglia inattesa (es. >10x rispetto a somma strikes di quel sottostante nel mock), il test deve fallire.

5) “Testare prima di proporre” (procedura di verifica pratica)
   - Dopo implementazione:
     1. Aprire Risk Analyzer nel preview.
     2. Selezionare il portafoglio corretto.
     3. Andare su “Holdings Consolidate” e verificare ALIBABA:
        - Stock (senza protezioni): circa 14.670€ (con arrotondamento a 0 decimali)
        - PUT: circa 27.986€
        - Totale: circa 42.656€
     4. Espandere ALIBABA nel breakdown e verificare che le PUT elencate siano solo strike 165 e 170 (contratti 1 ciascuna) e nessun’altra.
   - Solo dopo questi passaggi si rimuovono eventuali log temporanei e si considera chiusa la fix.

Cambiamenti previsti (file)
- `src/lib/sectorExposure.ts`
  - Sostituire la logica di `isSameHolding()` con chiave robusta + stopwords.
  - Refactor `calculateConsolidatedTopHoldings()` per usare `holdingsByKey`.
- `src/components/risk/EquityExposureView.tsx`
  - Aggiungere UI “expand breakdown” per ogni holding (riutilizzando `holding.sources` già presenti).
- `src/test/...`
  - Nuovi test unitari per matching e consolidamento.

Rischi/Edge cases considerati
- Aziende con nomi molto corti o simili (es. “NETEASE” vs ticker “NTES”): gestito con alias canonici già presenti e match più rigoroso sui token distintivi.
- Holdings ETF con nomi “sporchi”/troncati: il breakdown renderà visibile l’origine; il matching severo ridurrà accorpamenti non desiderati.
- Prestazioni: il passaggio a mappa per chiave riduce la complessità e migliora stabilità.

Criteri di completamento (Definition of Done)
- ALIBABA in “Holdings Consolidate” mostra importi coerenti con 100 azioni + 2 PUT vendute, senza valori gonfiati.
- Breakdown mostra esattamente quali PUT contribuiscono al totale.
- Test unitari coprono i casi di collisione su HOLDING/HOLDINGS/GROUP e impediscono regressioni future.
