# Architettura di GymPlan

GymPlan è un'app **tutta locale**: un server Node (Express + SQLite) e un'interfaccia React, che girano sullo stesso computer. Niente cloud, niente account. In futuro il tutto viene impacchettato come app desktop (Electron) per Mac e Windows.

## Cartelle

```
shared/            tipi e regole usati sia dal server sia dall'interfaccia (date, stati delle scadenze, pagamenti)
server/
  app.ts           avvio: apre il database, applica le migrazioni, monta i moduli (startServer / openData)
  db.ts            SQLite (node:sqlite), migrazioni, backup, impostazioni per modulo
  store.ts         dati e regole del modulo "core" (corsi, iscritti, pagamenti, lezioni, certificati)
  api.ts           API JSON del core + gestione errori comune
  modules/         moduli lato server (index.ts = elenco dei moduli installati)
  index.ts         avvio da riga di comando (npm start / npm run dev)
  demo.ts          dati di esempio
src/
  modules/         moduli lato interfaccia (index.ts = elenco, core.ts = pagine base)
  views/           pagine del core: Dashboard, Corsi, Statistiche, Impostazioni
  components/      componenti condivisi (finestre, scheda iscritto, intestazioni)
  store.tsx        stato dell'app e navigazione (useApp)
  api.ts           chiamate al server (request<T>() per i moduli)
  styles/          modernist.css (design system) + app.css (variante GymPlan)
tests/             test automatici (vitest)
design/            prototipo e specifiche di design (solo riferimento)
```

## Moduli

Ogni funzione grande è un **modulo**, con due metà indipendenti:

**Server** — `server/modules/<id>/index.ts` esporta un `ServerModule` (vedi `server/modules/types.ts`):
- `migrations`: modifiche allo schema del database, con id `"<id>/NNN-descrizione"`. Si aggiungono in coda e **non si modificano mai** dopo il rilascio.
- `createRouter(ctx)`: le sue API, montate su `/api/<id>`. `ctx` dà accesso a `db`, `dataDir`, `core` (lo Store) e `today()`.
- `init(ctx)`: opzionale, per dati iniziali.
- `onParticipantRemoved(ctx, id)`: alla disiscrizione il modulo cancella i dati personali che conserva su quella persona (es. la cartella dell'assistente). I pagamenti restano nel core.
- File del modulo in `<dataDir>/<id>/`. Impostazioni del modulo con `moduleSettings(db, '<id>', defaults)` (chiavi `"<id>.<chiave>"` nella tabella `settings`).
- Gli errori per l'utente si lanciano come `new ApiError(status, 'messaggio in italiano')`.

**Interfaccia** — `src/modules/<id>/index.ts` esporta un `ClientModule` (vedi `src/modules/types.ts`):
- `View`: la pagina, con voce nella barra in alto e indirizzo `#/<id>`.
- `settings`: sezioni aggiunte in fondo a Impostazioni.
- `participantSections`: sezioni aggiunte nella scheda dell'iscritto.
- Usa `PageHead page="<id>"` per il titolo (il numero "0N /" si calcola da solo), `useApp()` per lo stato del core, `request<T>()` per le proprie API.

Per installare un modulo basta aggiungerlo all'elenco in `server/modules/index.ts` e in `src/modules/index.ts`.

## Database e aggiornamenti

- File: `<dataDir>/fitflow.sqlite`. All'avvio si applicano le migrazioni mancanti, ognuna in una transazione.
- Prima di modificare un database già esistente, ne viene salvata una copia in `<dataDir>/backup/`.
- Le date sono stringhe ISO `"AAAA-MM-GG"`; gli importi in euro come numeri.

## Sicurezza

- Il server ascolta solo su `127.0.0.1` e accetta solo richieste con header `Host` locale (protezione dal DNS rebinding).
- Le richieste che modificano dati vengono rifiutate se arrivano da un altro sito (`Origin` diverso o `Sec-Fetch-Site: cross-site`).
- File caricati salvati con nomi generati, tipi in whitelist; l'assistente AI accetta solo motori su questo computer o sulla rete locale.
- Un modulo non deve mai mandare al modello dati di un iscritto diverso da quello scelto.

## Stile

Tutto l'aspetto viene da `src/styles/modernist.css` (token e componenti: `.btn`, `.tag`, `.input`, `.seg`, `.table`, `.dialog`…) e `src/styles/app.css` (variante ammorbidita: angoli arrotondati, pillole, Nunito). Le pagine nuove riusano queste classi e i token `var(--color-*)`, `var(--radius-*)`: niente colori o font scritti a mano. Testi dell'interfaccia in italiano.

## Regole del progetto

- Tutto in locale: nessun dato esce dal computer.
- La dashboard non mostra importi in euro (scelta esplicita dell'utente): i dati economici stanno in Statistiche e Finanze.
- Ogni regola di business ha un test in `tests/`. Prima di consegnare: `npm run typecheck`, `npm test`, `npm run build`.
