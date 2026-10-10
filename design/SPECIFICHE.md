# Handoff: Gestione Corsi Ginnastica (web app desktop)

## Overview
Web app gestionale per un istruttore/amministratore di corsi di ginnastica. Usata principalmente da PC. Permette di:
- gestire più corsi (nome, giorni, orario, capienza);
- iscrivere e disiscrivere partecipanti;
- creare le date delle lezioni e segnare le presenze;
- tracciare per ogni iscritto tre scadenze indipendenti: **abbonamento** (pagamenti), **iscrizione annuale**, **certificato medico** (con upload del file PNG/JPEG/PDF);
- configurare i tipi di abbonamento nelle impostazioni;
- vedere dati a colpo d'occhio (dashboard) e statistiche (incluse quelle economiche, volutamente solo nella pagina Statistiche).

Lingua UI: **italiano**.

## About the Design Files
I file in questo pacchetto sono **riferimenti di design creati in HTML**: prototipi che mostrano aspetto e comportamento previsti, **non codice di produzione da copiare**. Il compito è **ricreare questi design in un vero progetto** usando un framework adeguato. Non esistendo ancora un codebase, si consiglia:
- **Frontend:** React + TypeScript (Vite o Next.js), CSS con variabili (o Tailwind configurato con i token sotto).
- **Backend/dati:** un database reale (es. Supabase/Postgres, o SQLite + API) — nel prototipo tutto è in memoria e si perde al refresh.
- **File certificati:** storage di file (es. Supabase Storage / S3). Nel prototipo si usa `URL.createObjectURL`, non persistente.
- **Auth:** login per l'istruttore (un solo ruolo admin per ora).

## Fidelity
**High-fidelity.** Colori, tipografia, spaziature, raggi e interazioni sono definitivi. Ricreare la UI fedelmente.

## Screens / Views

Layout globale: barra di navigazione in alto (sfondo `#201e1d`, testo chiaro, angoli inferiori arrotondati 18px, margine laterale 16px, padding 14px 28px). Brand "GESTIONE CORSI" con pallino rosso 14px. Voci: Dashboard · Corsi · Statistiche · Impostazioni (attiva `#ff563c`, inattive `#bab6b6`). Contenuto pagina: padding 40px 44px, max-width 1180px. Ogni pagina ha un kicker (12px, 600, letter-spacing 0.12em, uppercase, rosso) es. "01 / Dashboard" e un H1 64px/800, letter-spacing -0.03em.

### 1. Dashboard
- **Header:** kicker + H1 "Panoramica"; a destra "Ciao, {nome}" + data.
- **3 tile KPI** (grid 3 colonne, gap 12px, radius 18px, padding 24px, testo chiaro): Iscritti totali (bg `#ec3013`), Corsi attivi (bg `#dd2b0f`), Certificati da rinnovare (bg `#201e1d`, numero in `#ff563c`). Etichette 11px uppercase; numeri 64px/800.
- **Due colonne** separate da linea verticale 1px:
  - *Lezioni di oggi*: righe arrotondate (radius 12px, bg surface) con blocco orario a sinistra (88px, bg `#fff2ef`, testo `#ae1800`, 22px/800) e nome corso + "n/capienza iscritti". Click → apre il corso.
  - *Avvisi*: elenco di problemi per iscritto (certificato, abbonamento, iscrizione annuale non validi). Gli scaduti/mancanti hanno sfondo `#fff2ef` e vengono mostrati per primi. Tag di stato a destra. Click → apre la scheda dell'iscritto nel suo corso.
- **Nessun dato economico in dashboard** (richiesta esplicita).

### 2. Corsi (master–detail)
- Colonna sinistra 280px: lista corsi (card radius 12px, gap 8px). Selezionata: bg rosso, testo chiaro. Ogni card: nome (16px/800), giorni · orario, barra capienza (6px, pill) + "n/capienza iscritti".
- Destra: nome corso H2 44px/800, giorni · orario, "Posti occupati". Selettore segmentato (pill) **Iscritti / Presenze**.
- **Vista Iscritti:** pulsante primario "Nuovo iscritto". Tabella (`.table`) con colonne: Nome (+ telefono sotto, 12px muted) · Abbonamento (nome + tag stato + "Pagato fino al gg/mm/aaaa") · Iscrizione (tag + data) · Certificato (tag + data) · Presenze %. Click riga → scheda iscritto. Tabella in contenitore `overflow-x:auto`.
- **Vista Presenze:** input data + pulsante "Aggiungi data". Griglia: righe = iscritti (nome 190px), colonne = lezioni (76px: giorno abbreviato, data gg/mm, link "Tutti n/N"), ultima colonna Tot. %. Cella = quadrato 30px, radius 8px, bordo 1.5px `#9b9797`; presente = pieno `#201e1d` con check bianco. Click cella = toggle; "Tutti" = segna tutti presenti (o tutti assenti se già tutti presenti). Data duplicata ignorata; lezioni ordinate per data.

### 3. Scheda iscritto (modale, max 640px, max-height 92vh, scroll)
Sezioni in ordine:
1. Nome (dialog-title) + corso; pulsante chiudi.
2. Riga 3 colonne: Telefono · Livello · Presenze % (24px/800 rosso).
3. **Riquadro Abbonamento** (bordo 1px divider, radius 18px; bg `#fff2ef` se scaduto): nome piano + "durata · prezzo", tag stato, "Pagato fino al …". Pulsante "Registra pagamento" → mini-form (data, abbonamento) con anteprima "Importo €X · copre dal … al …" → Conferma. Storico pagamenti: data · piano · periodo · importo.
4. **Riquadro Iscrizione annuale:** tag stato, input data scadenza (modificabile), quota annuale, pulsante "Rinnova per 1 anno".
5. **Riquadro Certificato medico:** tag stato, input data scadenza (con avviso se mancante). Sotto: icona documento, nome file + meta ("PDF · 120 KB · caricato il …"), pulsanti Visualizza / Carica file (o Sostituisci) / Elimina. Accetta solo PNG, JPEG, PDF; altrimenti messaggio d'errore.
6. Registro presenze: quadratini 52×30 con data sotto.
7. Note.
8. "Disiscrivi dal corso" → box di conferma rosso chiaro con "Conferma disiscrizione" / "Annulla". Rimuove l'iscritto dal corso e dal registro.

**Visualizzatore certificato:** overlay a schermo intero (bg `#2d2b2b`), barra superiore scura con nome iscritto/file, "Scarica" e "Chiudi". PDF in iframe, immagini con `object-fit: contain`.

### 4. Nuovo iscritto (modale 600px)
Campi: Nome e cognome*, Telefono*, Abbonamento (select dai piani), Livello (Base/Intermedio/Avanzato), Scadenza iscrizione annuale (precompilata con la scadenza stagione dalle impostazioni), Scadenza certificato medico, Primo pagamento (segmentato "Pagato oggi" / "Da pagare" + info "€X · coperto fino al …"), Note. Errori: nome/telefono mancanti, nessun abbonamento, corso al completo.

### 5. Statistiche
- Grafico a barre "Andamento iscritti" (6 mesi; barre radius 8px in alto, mese corrente `#ec3013`, altri `#ffc4b8`).
- Tile "Incassato a {mese}" (bg rosso) = somma dei pagamenti registrati nel mese corrente. Tile "Corso in testa" (bg scuro).
- "Iscritti per corso": barre orizzontali pill.
- "Stato pagamenti": barra segmentata pill (In regola `#bab6b6`, In scadenza `#ffc4b8`, Da pagare `#ec3013`) + legenda.

### 6. Impostazioni
- **Abbonamenti:** tabella Nome · Durata (mesi) · Prezzo · Iscritti · Elimina (bloccato se usato da iscritti, con messaggio). Form "Nuovo abbonamento": nome, durata in mesi, prezzo €.
- **Iscrizione annuale:** quota (€) e data scadenza stagione.
- Default: Mensile 1 mese €45 · Trimestrale 3 mesi €120 · Semestrale 6 mesi €220 · Annuale 12 mesi €400. Quota iscrizione €30, scadenza stagione 31/08.

## Interactions & Behavior
- **Stato scadenze** (calcolato dalla data rispetto a oggi): `scaduto` (<0 giorni), `in_scadenza` (≤ soglia), `valido`, `mancante` (nessuna data). Soglie: certificato 30 gg, iscrizione 30 gg, abbonamento 4 gg (da rendere configurabili).
- Etichette: Abbonamento → In regola / In scadenza / Da pagare. Certificato → Valido / In scadenza / Scaduto / Mancante. Iscrizione → Attiva / In scadenza / Scaduta / Mancante.
- **Registra pagamento:** se il "pagato fino al" è ≥ data pagamento, il nuovo periodo parte dalla vecchia scadenza (rinnovo anticipato); altrimenti dalla data del pagamento. Fine = inizio + mesi del piano. Aggiorna anche il piano corrente dell'iscritto.
- **Rinnova iscrizione:** +12 mesi dalla scadenza attuale (o da oggi se già scaduta).
- Click sul backdrop chiude le modali; click dentro no.
- Hover/pressed/focus: usare quelli del design system (hover tint, pressed `#dd2b0f`, focus `outline 2px #ec3013, offset 2px`).
- Responsive: desktop-first; tabelle scorrono orizzontalmente se strette; titoli corso vanno a capo.

## State Management / Modello dati
```
Course     { id, name, giorni, orario, capienza }
Plan       { id, name, mesi, prezzo }
Settings   { quotaIscrizione, scadenzaStagione, soglie… }
Participant{ id, courseId, name, phone, livello, note, planId,
             pagatoFino: date, iscrizioneScadenza: date, certScadenza: date,
             certFile?: { url, name, mime, size, uploadedAt } }
Payment    { id, participantId, date, dal, al, importo, planId }
Lesson     { id, courseId, date }
Attendance { lessonId, participantId, present: bool }
```
UI state: tab attiva, corso selezionato, vista Iscritti/Presenze, iscritto aperto, form aperti (nuovo iscritto, pagamento), conferma disiscrizione, viewer aperto.
Nota: un partecipante iscritto a più corsi va modellato come Persona + Iscrizione(corso) — nel prototipo è un record per corso.

## Design Tokens
Base: design system "Modernist", ammorbidito su richiesta.
- **Colori:** bg `#f3f2f2` · surface `#eae9e9` · testo `#201e1d` · accent `#ec3013` · divider `rgba(32,30,29,0.4)`
- Accent ramp: 100 `#fff2ef` · 200 `#ffe0d9` · 300 `#ffc4b8` · 400 `#ff9783` · 500 `#ff563c` · 600 `#dd2b0f` · 700 `#ae1800` · 800 `#7c1405`
- Neutral: 200 `#eae7e7` · 300 `#d7d3d3` · 400 `#bab6b6` · 500 `#9b9797` · 700 `#605d5d` · 900 `#2d2b2b`
- **Font:** Nunito (Google Fonts), pesi 400/600/700/800/900, per titoli e testo.
- **Tipografia:** H1 64px/800/-0.03em · H2 corso 44px/800 · KPI 64px/800 · kicker/label 11–12px uppercase 0.08–0.12em · body 13–14px.
- **Radius:** sm 8px · md 12px · lg 18px · pulsanti, tag, selettori segmentati = pill (9999px).
- **Bordi:** 1px divider per riquadri e separatori (niente bordi spessi).
- **Ombre:** modale `0 12px 32px rgba(45,43,43,0.22)`.
- **Spaziature:** scala 4px (4/8/12/16/24/32).
- Tag: neutral (bg `#eae7e7`) = ok · outline = in scadenza · accent (bg `#fff2ef`, testo `#7c1405`) = scaduto/mancante.

## Assets
Nessuna immagine. Icone: **Lucide** (plus, x, eye, upload, download, trash, file-check, refresh, user-minus).

## Files
- `Gestione Corsi Ginnastica.dc.html` — prototipo completo (template + logica in un unico file). Aprilo nel browser insieme a `support.js` e alla cartella `_ds/` per vederlo funzionare.
- `_ds/modernist-…/styles.css` — token e classi componenti del design system (`.btn`, `.tag`, `.input`, `.seg`, `.table`, `.dialog`, `.nav`, `.hr`).
