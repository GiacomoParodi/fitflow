# FitFlow

Web app per gestire corsi di ginnastica, iscritti, presenze, pagamenti, iscrizioni annuali e certificati medici.
Gira sul tuo PC: un piccolo server Node salva tutto in un database SQLite e i certificati in una cartella, quindi i dati restano anche chiudendo il browser o spegnendo il computer.

Implementa il design `design/Gestione Corsi Ginnastica.dc.html` (specifiche in `design/SPECIFICHE.md`), versione "Modernist ammorbidita" con font Nunito.

## Requisiti

- **Node.js 22.13 o successivo** (usa il modulo SQLite integrato in Node, nessun database da installare). Scaricalo da nodejs.org, versione LTS.

## Primo avvio

```bash
npm install
npm run build
npm start
```

Per sviluppatori: la struttura del codice e il sistema a moduli sono descritti in [docs/ARCHITETTURA.md](docs/ARCHITETTURA.md).

Poi apri **http://localhost:3000** nel browser.

Al primo avvio il database è vuoto, con i quattro abbonamenti predefiniti. Crea i corsi da **Impostazioni → Corsi**.
Per provare l'app con i dati di esempio del prototipo (4 corsi, 22 iscritti), prima di inserire dati tuoi esegui:

```bash
npm run demo
```

## Comandi

| Comando | Cosa fa |
| --- | --- |
| `npm start` | Avvia l'app (serve prima `npm run build`) |
| `npm run dev` | Avvia in modalità sviluppo, con ricarica automatica delle modifiche al codice |
| `npm run build` | Controlla i tipi e compila l'interfaccia in `dist/` |
| `npm run demo` | Carica i dati di esempio (solo su database vuoto) |
| `npm test` | Esegue i test |

Variabili facoltative: `PORT` (default 3000), `DATA_DIR` (default `data/`), `HOST` (default `127.0.0.1`).

## Dove sono i dati

Tutto sta in `data/`:

- `fitflow.sqlite`: corsi, abbonamenti, iscritti, pagamenti, lezioni, presenze, impostazioni;
- `certificati/`: i file PNG, JPEG o PDF dei certificati medici (max 15 MB ciascuno).

**Backup:** chiudi l'app e copia l'intera cartella `data/`. Per ripristinare, rimettila al suo posto. Prima di ogni aggiornamento del database l'app salva da sola una copia in `data/backup/`.

## Sicurezza

L'app non ha un login: per questo il server ascolta solo su `127.0.0.1` ed è raggiungibile solo dal PC su cui gira.
Non impostare `HOST=0.0.0.0` né esporla in rete senza aggiungere prima un'autenticazione, perché contiene dati sanitari (certificati medici).

## Come è fatta

```
fitflow/
  design/   prototipo HTML e specifiche di Claude Design (solo riferimento)
  shared/   tipi, date e regole (stati delle scadenze, periodo di un pagamento, rinnovo) usati da server e interfaccia
  server/   Express + SQLite: store.ts (dati e regole), api.ts (API JSON), demo.ts (dati di esempio)
  src/      interfaccia React + TypeScript
    views/       Dashboard, Corsi (iscritti + presenze), Statistiche, Impostazioni
    components/  scheda iscritto, nuovo iscritto, visualizzatore certificato
    styles/      modernist.css (design system) + app.css (variante ammorbidita del progetto)
  tests/    test delle regole e del database
```

Regole principali (come nel prototipo):

- **Stati delle scadenze:** scaduto (data passata), in scadenza (entro la soglia), valido, mancante (nessuna data). Soglie predefinite: certificato 30 giorni, iscrizione 30, abbonamento 4, modificabili in Impostazioni → Generali.
- **Registra pagamento:** se l'abbonamento copre ancora la data del pagamento, il nuovo periodo parte dalla vecchia scadenza; altrimenti dalla data del pagamento. Aggiunge i mesi del piano scelto.
- **Rinnova iscrizione:** +12 mesi dalla scadenza attuale, o da oggi se è già scaduta.
- **Disiscrizione:** l'iscritto sparisce dal corso, dal registro presenze e il suo certificato viene cancellato; i pagamenti restano per l'incassato del mese e l'andamento iscritti.
- **Incassato del mese:** somma dei pagamenti registrati nel mese corrente (solo in Statistiche, mai in dashboard).
- **Andamento iscritti:** iscritti attivi alla fine di ciascuno degli ultimi 6 mesi, calcolato dalle date di iscrizione e disiscrizione.

## Differenze rispetto al prototipo

Il prototipo teneva tutto in memoria e alcune cose erano finte; qui sono reali:

- dati salvati su disco (SQLite + cartella certificati);
- "oggi" è la data reale, e "Lezioni di oggi" mostra i corsi che si tengono nel giorno della settimana corrente;
- l'andamento iscritti è calcolato dai dati, non inventato;
- aggiunte in **Impostazioni**: gestione dei **corsi** (crea, modifica, elimina, con scelta dei giorni), **nome istruttore** e **soglie** delle scadenze. Il prototipo non aveva un modo per creare corsi;
- nella griglia presenze, passando sopra una data compare una piccola × per eliminare una lezione aggiunta per errore;
- un iscritto con il primo pagamento "Da pagare" risulta senza copertura ("Pagato fino al —") invece che con una data fittizia;
- aggiungendo mesi a fine mese la data si ferma all'ultimo giorno (31/01 + 1 mese = 28/02).

Come nel prototipo, un iscritto appartiene a un solo corso: chi frequenta due corsi va iscritto due volte.
