# Pubblicare una nuova versione

Le versioni dell'app desktop si pubblicano come **release GitHub** del repository pubblico `GiacomoParodi/fitflow`. Tutto il lavoro (pacchetti Mac e Windows, caricamento, pubblicazione) lo fa GitHub Actions: in locale basta creare un tag.

## Il modo più semplice: il pulsante su GitHub

1. Aggiorna `"version"` in `package.json` (es. da `1.0.0` a `1.0.1`) e manda il commit su `main`.
2. Su GitHub apri **Actions** → **Rilascio** (nella colonna a sinistra) → **Run workflow** → lascia `main` → **Run workflow**.
3. Dopo circa 15 minuti la nuova versione compare in **Releases**; il tag `vX.Y.Z` viene creato da GitHub alla pubblicazione.

Se la versione indicata in `package.json` è già pubblicata, il rilascio si ferma con un messaggio: basta aumentare il numero.

## In alternativa: con un tag dal terminale

1. Assicurati che `main` sia a posto e che i controlli passino:

   ```bash
   npm run typecheck && npm test && npm run build
   ```

2. Aggiorna il numero di versione in `package.json` (e `package-lock.json`) e crea il commit e il tag in un colpo solo:

   ```bash
   npm version patch   # 1.0.0 → 1.0.1 (correzioni)
   npm version minor   # 1.0.0 → 1.1.0 (funzioni nuove)
   npm version major   # 1.0.0 → 2.0.0 (cambiamenti grandi)
   ```

   `npm version` crea il commit "1.0.1" e il tag `v1.0.1`. In alternativa, a mano: cambia `"version"` in `package.json`, fai il commit, poi `git tag v1.0.1`.

3. Manda su GitHub il commit e il tag:

   ```bash
   git push origin main --follow-tags
   ```

Il tag deve essere esattamente `v` + la versione di `package.json` (es. `v1.0.1`), altrimenti il rilascio si ferma con un errore.

## Cosa fa GitHub Actions

Il workflow `.github/workflows/release.yml` parte da solo al push di un tag `vX.Y.Z`:

1. **prepara** – controlla che tag e versione coincidano e crea la release in **bozza**, con le istruzioni di installazione e l'elenco delle modifiche generato dai commit;
2. **pacchetti** – in parallelo:
   - su macOS costruisce `FitFlow-X.Y.Z-arm64.dmg` (Apple Silicon) e `FitFlow-X.Y.Z-x64.dmg` (Intel), più i relativi `.zip`, con firma ad-hoc;
   - su Windows costruisce l'installer `FitFlow-Setup-X.Y.Z.exe`;
   - carica tutto nella bozza, insieme a `latest.yml` / `latest-mac.yml` (servono agli aggiornamenti automatici);
3. **pubblica** – se entrambi i pacchetti sono riusciti, pubblica la release e la segna come "Latest".

Da quel momento le app già installate vedono la nuova versione (Windows la scarica e installa, Mac propone la pagina di download).

Dura circa 10–15 minuti. Per un repository pubblico i minuti di GitHub Actions sono gratuiti, anche quelli macOS e Windows.

## Dove trovare la release

- Avanzamento: scheda **Actions** del repository → workflow **Rilascio**.
- Risultato: **https://github.com/GiacomoParodi/fitflow/releases** (l'ultima è anche su `/releases/latest`, il link da dare agli utenti).

## Se qualcosa va storto

- **Un job fallisce:** la release resta in bozza (invisibile agli utenti e agli aggiornamenti). Correggi, poi rilancia il workflow dalla scheda Actions (*Re-run failed jobs*); i file già caricati nella bozza vengono sostituiti.
- **Tag sbagliato:** cancella la bozza dalla pagina Releases e il tag (`git push origin :refs/tags/v1.0.1` e `git tag -d v1.0.1`), poi ricomincia.
- **Versione già pubblicata con un problema:** non riusare lo stesso numero; pubblica subito una versione successiva (es. `1.0.2`).

## Prova in locale

```bash
npm run desktop   # compila tutto e apre l'app (dati in una cartella "FitFlow-sviluppo", separata da quelli veri)
npm run dist      # crea il pacchetto per il sistema in uso in release/, senza pubblicare
```

Su Mac, `npm run dist` crea i `.dmg`; su Windows l'installer. I pacchetti Mac si possono costruire solo su un Mac.

## Note tecniche

- **Firma:** nessun certificato a pagamento. Su Mac l'app ha una firma *ad-hoc* (`mac.identity: "-"` in `electron-builder.yml`): senza nessuna firma, sui Mac Apple Silicon risulterebbe "danneggiata". Gli utenti devono comunque autorizzarla al primo avvio (vedi `docs/INSTALLAZIONE.md`). Su Windows compare l'avviso SmartScreen.
- **Aggiornamenti:** su Windows con `electron-updater` (legge `latest.yml` dalla release). Su Mac Squirrel non può aggiornare un'app non firmata, quindi l'app interroga `api.github.com/repos/GiacomoParodi/fitflow/releases/latest` e propone il download. Codice in `electron/updater.ts`.
- **Database:** se una versione nuova aggiunge migrazioni, all'avvio viene fatta una copia del database in `dati/backup/` prima di applicarle. Le migrazioni già rilasciate non vanno mai modificate (vedi `docs/ARCHITETTURA.md`).
